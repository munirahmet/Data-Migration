const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { Pool, pg, Client } = require("pg");
const { applySqlScript } = require("./sqlScriptFunc");
const { verbose } = require("sqlite3");
const { error, log } = require("console");
const {
  fetchScriptsBetweenVersions,
  compareVersions,
} = require("./backendUtils");
const app = express();

const os = require("os");

const isWindows = os.platform() === "win32";
const isMacOS = os.platform() === "darwin"; 

const pgDumpPath = isWindows 
    ? path.join(__dirname, "pg_commands/windows/pg_dump.exe") 
    : path.join(__dirname, "pg_commands/macos/pg_dump");

const pgRestorePath = isWindows 
    ? path.join(__dirname, "pg_commands/windows/pg_restore.exe") 
    : path.join(__dirname, "pg_commands/macos/pg_restore");

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const sqliteDb = new sqlite3.Database(
  path.join(__dirname, "../database/db.sqlite")
);

const getPostgresConfig = (configName) => {
  return new Promise((resolve, reject) => {
    sqliteDb.get(
      "SELECT * FROM configurations WHERE config_name = ?",
      [configName],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });
};

let pools = {};

const initializePostgresConnections = async () => {
  const configNames = await new Promise((resolve, reject) => {
    sqliteDb.all("SELECT config_name FROM configurations", (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows.map((row) => row.config_name));
      }
    });
  });

  for (const configName of configNames) {
    const config = await getPostgresConfig(configName);
    pools[configName] = new Pool({
      host: config.host,
      user: config.user,
      password: config.password,
      port: config.port,
    });
  }
};

initializePostgresConnections().catch((err) => {
  console.error("Error initializing PostgreSQL connection:", err);
  process.exit(1);
});

// Dosya yolları
const backupsDirectory = "./backups/";
const rollbackScriptsDirectory = "./scripts/rollback";
const migrationScriptsDirectory = "./scripts/migration";

const fileExists = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        reject(new Error(`File not found: ${filePath}`));
      } else {
        resolve(true);
      }
    });
  });
};

// Endpoint to get the current version from PostgreSQL
app.get("/current_version", async (req, res) => {
  const { configName, database } = req.query;  
  const config = await getPostgresConfig(configName);

  const pool = new Pool({
    host: config.host,
    user: config.user,
    password: config.password,
    database,
    port: config.port,
  });

  if (!pool) {
    return res.status(404).send(`No pool found for config: ${configName}`);
  }

  const client = await pool.connect();

  try {
    // Version tablosunun varlığını kontrol edin, yoksa oluşturun
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'version') THEN
          CREATE TABLE version (
            id SERIAL PRIMARY KEY,
            version_number VARCHAR(255) NOT NULL
          );
          INSERT INTO version (version_number) VALUES ('1.0.0');
        END IF;
      END $$;
    `);

    const result = await client.query(
      "SELECT version_number FROM version ORDER BY id DESC FETCH FIRST 1 ROWS ONLY"
    );
    console.log(result);
    if (result.rows.length > 0) {
      res.json({ version: result.rows[0].version_number });
    } else {
      res.status(404).json({ message: "Version table does not exist" });
    }
  } catch (err) {
    console.error("Error fetching current version:", err);
    res.status(500).send("Error fetching current version");
  } finally {
    client.release();
  }
});






// Endpoint to get PostgreSQL configurations from SQLite
app.get("/configurations", async (req, res) => {
  sqliteDb.all(
    "SELECT DISTINCT config_name FROM configurations",
    (err, rows) => {
      if (err) {
        console.error("Error fetching configurations:", err);
        res.status(500).send("Error fetching configurations");
      } else {
        res.json(rows);
      }
    }
  );
});

// Endpoint to get configuration details from SQLite
app.get("/config_details", async (req, res) => {
  const { configKey } = req.query;
  sqliteDb.get(
    "SELECT * FROM configurations WHERE config_name = ?",
    [configKey],
    (err, row) => {
      if (err) {
        console.error("Error fetching configuration details:", err);
        res.status(500).send("Error fetching configuration details");
      } else {
        res.json(row);
      }
    }
  );
});

// Updated /add_configuration endpoint
app.post("/add_configuration", async (req, res) => {
  const { config_name, host, user, password, port } = req.body;

  sqliteDb.get(
    "SELECT * FROM configurations WHERE config_name = ?",
    [config_name],
    async function (err, row) {
      if (err) {
        console.error("Error checking configuration:", err);
        return res.status(500).send("Error checking configuration");
      }
      if (row) {
        return res
          .status(400)
          .send("A configuration with the same name already exists");
      }

      sqliteDb.run(
        "INSERT INTO configurations (config_name, host, user, password, port) VALUES (?, ?, ?, ?, ?)",
        [config_name, host, user, password, port],
        async function (err) {
          if (err) {
            console.error("Error adding configuration:", err);
            return res.status(500).send("Error adding configuration");
          }

          pools[config_name] = new Pool({
            host,
            user,
            password,
            port
          });

          res.send("Configuration added successfully");
        }
      );
    }
  );
});

// Updated /update_configuration endpoint
app.put("/update_configuration", async (req, res) => {
  const {
    original_config_name,
    config_name,
    host,
    user,
    password,
    port,
  } = req.body;

  sqliteDb.get(
    "SELECT * FROM configurations WHERE config_name = ? AND config_name != ?",
    [config_name, original_config_name],
    async function (err, row) {
      if (err) {
        console.error("Error checking configuration:", err);
        return res.status(500).send("Error checking configuration");
      }
      if (row) {
        return res
          .status(400)
          .send("A configuration with the same name already exists");
      }

      sqliteDb.run(
        "UPDATE configurations SET config_name = ?, host = ?, user = ?, password = ?, port = ? WHERE config_name = ?",
        [config_name, host, user, password, port, original_config_name],
        function (err) {
          if (err) {
            console.error("Error updating configuration:", err);
            res.status(500).send("Error updating configuration");
          } else {
            delete pools[original_config_name];
            pools[config_name] = new Pool({
              host,
              user,
              password,
              port
            });
            res.send('Configuration updated successfully');
          }
        }
      );
    }
  );
});

app.delete("/delete_configuration", async (req, res) => {
  const { config_name } = req.body;
  sqliteDb.run(
    "DELETE FROM configurations WHERE config_name = ?",
    [config_name],
    function (err) {
      if (err) {
        console.error("Error deleting configuration:", err);
        res.status(500).send("Error deleting configuration");
      } else {
        res.send("Configuration deleted successfully");
      }
    }
  );
});

app.post("/check_migration_files", async (req, res) => {
  const { from, to } = req.body;
  try {
    const scripts = await fetchScriptsBetweenVersions("migration", from, to);
    res.send({ success: scripts.length > 0 });
  } catch (error) {
    res.send({ success: false, message: error.message });
  }
});

app.post("/check_rollback_files", async (req, res) => {
  const { to, from } = req.body;
  try {
    const scripts = await fetchScriptsBetweenVersions("rollback", to, from);
    res.send({ success: scripts.length > 0 });
  } catch (error) {
    res.send({ success: false, message: error.message });
  }
});

// Backup dosyalarını listeleme endpoint'i
app.get("/backup_list", (req, res) => {
  console.log("Backup list endpoint hit");
  fs.readdir(backupsDirectory, (err, files) => {
    if (err) {
      console.error("Error reading backup directory:", err);
      res.status(500).send("Error reading backup directory");
      return;
    }

    const backupFiles = files.filter((file) => path.extname(file) === ".sql");
    console.log("Backup files:", backupFiles);
    res.status(200).json(backupFiles);
  });
});

app.get("/get_script", (req, res) => {
  const { file, type } = req.query;
  const directory =
    type === "migration" ? migrationScriptsDirectory : rollbackScriptsDirectory;
  const filePath = path.join(directory, file);

  console.log(`Getting script content: ${filePath}`);

  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      res.status(500).send("Error reading file: " + err.message);
      return;
    }
    res.send(data);
  });
});

app.post("/save_script", (req, res) => {
  const { fileName, fileContent, fileType, isNewFile } = req.body;
  const directory =
    fileType === "migration"
      ? migrationScriptsDirectory
      : rollbackScriptsDirectory;
  const filePath = path.join(directory, fileName);

  if (isNewFile) {
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (!err) {
        console.error("File already exists:", filePath);
        res.status(400).send("File already exists");
        return;
      }

      fs.writeFile(filePath, fileContent, "utf8", (err) => {
        if (err) {
          console.error("Error writing file:", err);
          res.status(500).send("Error writing file: " + err.message);
          return;
        }
        res.send("File created successfully.");
      });
    });
  } else {
    fs.writeFile(filePath, fileContent, "utf8", (err) => {
      if (err) {
        console.error("Error writing file:", err);
        res.status(500).send("Error writing file: " + err.message);
        return;
      }
      res.send("File updated successfully.");
    });
  }
});

app.post("/delete_script", (req, res) => {
  const { fileName, fileType } = req.body;
  const directory =
    fileType === "migration"
      ? migrationScriptsDirectory
      : rollbackScriptsDirectory;
  const filePath = path.join(directory, fileName);

  console.log(`Deleting script: ${filePath}`);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error("File not found:", filePath);
      res.status(404).send("File not found");
      return;
    }

    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting file:", err);
        res.status(500).send("Error deleting file: " + err.message);
        return;
      }
      console.log("File deleted successfully:", filePath);
      res.send("File deleted successfully.");
    });
  });
});

// Dump endpoint'i
app.post("/dump", (req, res) => {
  const { target_db_connection } = req.body;
  const { host, user, password, database, port } = target_db_connection;

  const exportCon = `postgresql://${user}:${password}@${host}:${port}/${database}`;
  const dbname = database.toUpperCase();
  const now = new Date();
  const tarih = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const formattedDate = tarih
    .toISOString()
    .replace(/:/g, "_")
    .replace(/\..+/, "");
  const uniqueFileName = `backup_${dbname}_${formattedDate}.sql`;

  const dumpFilePath = path.join(backupsDirectory, uniqueFileName);

  console.log(
      `Veriler ${database} veritabanından dışa aktarılarak ${uniqueFileName} dosyasına kaydediliyor`
  );

  const dumpCommand = `"${pgDumpPath}" -Fc ${exportCon} > "${dumpFilePath}"`;

  exec(dumpCommand, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
      if (err) {
          console.error(`exec error: ${err}`);
          if (stderr.includes("does not exist")) {
              fs.unlinkSync(dumpFilePath); // Boş dosyayı sil
              res.status(404).send("Database does not exist");
          } else {
              res.status(500).send("Veriyi dışa aktarma işlemi sırasında bir hata oluştu. " + err);
          }
          return;
      }

      if (stderr) {
          console.error(`pg_dump error: ${stderr}`);
          fs.unlinkSync(dumpFilePath); // Boş dosyayı sil
          res.status(500).send("Veriyi dışa aktarma işlemi sırasında bir hata oluştu. " + stderr);
          return;
      }

      console.log("Dışa aktarma işlemi tamamlandı.");
      res.status(200).send(`Dışa aktarma işlemi tamamlandı ve ${uniqueFileName} dosyasına kaydedildi.`);
  });
});

// Restore endpoint'i
app.post("/restore", async (req, res) => {
  const { source_backup_file, target_db_connection, fullRestore } = req.body;
  const { host, user, password, database, port } = target_db_connection;
  const backupFilePath = path.join(backupsDirectory, source_backup_file);
  let importCon = `postgresql://${user}:${password}@${host}:${port}/${database}`;

  try {
      if (fullRestore) {
          const templateClient = new Client({
              user,
              password,
              host,
              database: "template1",
              port,
          });
          await templateClient.connect();

          console.log(`Terminating existing connections to database ${database}`);
          const terminateConnectionsCommand = `
              SELECT pg_terminate_backend(pg_stat_activity.pid)
              FROM pg_stat_activity
              WHERE pg_stat_activity.datname = '${database}'
                AND pid <> pg_backend_pid();
          `;
          await templateClient.query(terminateConnectionsCommand);

          console.log(`Dropping database ${database}`);
          const dropCommand = `DROP DATABASE ${database}`;
          await templateClient.query(dropCommand);

          console.log(`Creating database ${database}`);
          const createCommand = `CREATE DATABASE ${database}`;
          await templateClient.query(createCommand);

          importCon = `postgresql://${user}:${password}@${host}:${port}/${database}`;
          await templateClient.end();
      } else {
          const cleanClient = new Client({
              user,
              password,
              host,
              database,
              port,
          });
          await cleanClient.connect();

          const cleanDatabaseCommand = `
              DO $$ DECLARE
                  r RECORD;
              BEGIN
                  FOR r IN (SELECT conname, relname FROM pg_constraint JOIN pg_class ON conrelid = pg_class.oid WHERE contype = 'f')
                  LOOP
                      EXECUTE 'ALTER TABLE ' || r.relname || ' DROP CONSTRAINT ' || r.conname;
                  END LOOP;

                  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
                  LOOP
                      EXECUTE 'DROP TABLE ' || r.tablename || ' CASCADE';
                  END LOOP;

                  FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public')
                  LOOP
                      EXECUTE 'DROP SEQUENCE ' || r.sequence_name;
                  END LOOP;

                  FOR r IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public')
                  LOOP
                      EXECUTE 'DROP VIEW ' || r.table_name;
                  END LOOP;
              END $$;
          `;
          await cleanClient.query(cleanDatabaseCommand);
          await cleanClient.end();
      }

      const restoreCommand = `"${pgRestorePath}" --clean --if-exists --no-owner -d ${importCon} "${backupFilePath}"`;

      console.log(`Executing restore command: ${restoreCommand}`);
      await new Promise((resolve, reject) => {
          exec(
              restoreCommand,
              { maxBuffer: 1024 * 1024 * 10 },
              (err, stdout, stderr) => {
                  if (err) {
                      console.error("Error during restore:", stderr);
                      reject(err);
                  } else {
                      console.log("Restore stdout:", stdout);
                      console.log("Restore completed successfully.");
                      resolve();
                  }
              }
          );
      });

      res.status(200).send("Database restore completed successfully");
  } catch (error) {
      console.error("Error during restore:", error);
      res.status(500).send("An error occurred during database restore");
  }
});

// Migration list endpoint'i
app.get("/migration_list", (req, res) => {
  try {
    fs.readdir(migrationScriptsDirectory, (err, files) => {
      if (err) {
        console.error("Error reading migration scripts directory:", err);
        res.status(500).send("Error reading migration scripts directory");
        return;
      }

      const migrationScripts = files.filter(
        (file) => path.extname(file) === ".sql"
      );
      res.status(200).json(migrationScripts);
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("An error occurred while fetching migration scripts.");
  }
});

// Endpoint to list rollback scripts
app.get("/rollback_list", (req, res) => {
  try {
    fs.readdir(rollbackScriptsDirectory, (err, files) => {
      if (err) {
        console.error("Error reading rollback scripts directory:", err);
        res.status(500).send("Error reading rollback scripts directory");
        return;
      }

      const rollbackScripts = files.filter(
        (file) => path.extname(file) === ".sql"
      );
      res.status(200).json(rollbackScripts);
    });
  } catch (err) {
    console.error("Error:", err);
    res.status (500).send("An error occurred while fetching rollback scripts.");
  }
});

// Migrate endpoint'i
app.post("/migrate", async (req, res) => {
  const { from, to, target_db_connection, configName } = req.body;
  const { host, user, password, database, port } = target_db_connection;
  const pool = pools[configName];

  if (!pool) {
    return res.status(404).send(`No pool found for config: ${configName}`);
  }

  const client = new Client({
    host,
    user,
    password,
    database,
    port,
  });

  const executedScripts = [];

  try {
    await client.connect();

    // Check and create version table if it doesn't exist
    const checkTableQuery = `
      DO $$ 
      BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'version') THEN 
              CREATE TABLE version (
                  id SERIAL PRIMARY KEY,
                  version_number VARCHAR(255) NOT NULL
              );
              INSERT INTO version (version_number) VALUES ('1.0.0');
          END IF;
      END $$;
    `;
    await client.query(checkTableQuery);

    const scripts = await fetchScriptsBetweenVersions("migration", from, to);
    await client.query("BEGIN"); // Transaction başlangıcı

    for (const script of scripts) {
      const scriptPath = path.join(migrationScriptsDirectory, script);
      const scriptContent = fs.readFileSync(scriptPath, "utf8");
      if (!scriptContent) {
        console.error(`Script content is empty for script: ${scriptPath}`);
        continue;
      }
      await client.query(scriptContent); // Transaction içinde scriptleri çalıştır
      executedScripts.push(script); // Çalıştırılan scripti listeye ekle
    }
    await client.query("INSERT INTO version (version_number) VALUES ($1)", [to]);

    await client.query("COMMIT"); // Transaction başarılı olursa commit

    res.send({
      message: `Migrated from v${from} to v${to} successfully.`,
      executedScripts,
    });
  } catch (error) {
    await client.query("ROLLBACK"); // Hata durumunda transaction rollback
    console.error(`Error migrating from v${from} to v${to}:`, error);
    if (!res.headersSent) {
      res
        .status(500)
        .send(`Error migrating from v${from} to v${to}: ${error.message}`);
    }
  } finally {
    await client.end();
  }
});

// Rollback endpoint
app.post("/rollback", async (req, res) => {
  const { from, to, target_db_connection, configName } = req.body;
  const { host, user, password, database, port } = target_db_connection;
  const pool = pools[configName];

  if (!pool) {
    console.log(`No pool found for config: ${configName}`);
    return res.status(404).send(`No pool found for config: ${configName}`);
  }

  const client = new Client({
    host,
    user,
    password,
    database,
    port,
  });

  const executedScripts = [];

  try {
    await client.connect();

    console.log(`Fetching rollback scripts between ${to} and ${from}`);
    const scripts = await fetchScriptsBetweenVersions("rollback", to, from);
    console.log(`Rollback scripts to execute:`, scripts);

    await client.query("BEGIN"); // Transaction başlangıcı

    for (const script of scripts) {
      const scriptPath = path.join(rollbackScriptsDirectory, script);
      console.log(`Applying script: ${scriptPath}`);
      const scriptContent = fs.readFileSync(scriptPath, "utf8");
      if (!scriptContent) {
        console.error(`Script content is empty for script: ${scriptPath}`);
        continue;
      }
      await client.query(scriptContent); // Transaction içinde scriptleri çalıştır
      executedScripts.push(script); // Çalıştırılan scripti listeye ekle
    }
    await client.query("INSERT INTO version (version_number) VALUES ($1)", [to]);

    await client.query("COMMIT"); // Transaction başarılı olursa commit

    res.send({
      message: `Rolled back from v${from} to v${to} successfully.`,
      executedScripts,
    });
  } catch (error) {
    await client.query("ROLLBACK"); // Hata durumunda transaction rollback
    console.error(`Error rolling back from v${from} to v${to}:`, error);
    if (!res.headersSent) {
      res
        .status(500)
        .send(`Error rolling back from v${from} to v${to}: ${error.message}`);
    }
  } finally {
    await client.end();
  }
});


// Sunucuyu başlat
app.listen(PORT, () => {
  console.log(`Sunucu çalışıyor, port: ${PORT}`);
});
