import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Review from './Review';
import Loading from './Loading'; // Make sure to create a Loading component
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import InfoBox from '../components/InfoBox'; // InfoBox bileşenini doğru klasörden içe aktarıyoruz

const Restore = () => {
    const [backupFiles, setBackupFiles] = useState([]);
    const [selectedBackup, setSelectedBackup] = useState('');
    const [configurations, setConfigurations] = useState([]);
    const [selectedConfig, setSelectedConfig] = useState('');
    const [database, setDatabase] = useState(''); // New state for database input
    const [targetDbConnection, setTargetDbConnection] = useState({
        host: '',
        user: '',
        password: '',
        port: ''
    });
    const [errorMessage, setErrorMessage] = useState('');
    const [showReview, setShowReview] = useState(false);
    const [fullRestore, setFullRestore] = useState(false);
    const [loading, setLoading] = useState(false); // State variable for loading

    useEffect(() => {
        axios.get('http://localhost:3000/backup_list')
            .then(response => setBackupFiles(response.data))
            .catch(error => toast.error('Error fetching backup list:', error));

        axios.get('http://localhost:3000/configurations')
            .then(response => setConfigurations(response.data))
            .catch(error => toast.error('Error fetching configurations:', error));
    }, []);

    const handleConfigChange = async (e) => {
        const configName = e.target.value;
        setSelectedConfig(configName);

        if (configName) {
            try {
                const response = await axios.get('http://localhost:3000/config_details', {
                    params: { configKey: configName }
                });

                const config = response.data;
                setTargetDbConnection({
                    host: config.host,
                    user: config.user,
                    password: config.password,
                    port: config.port
                });
            } catch (error) {
                toast.error('Error fetching config details:', error);
                setErrorMessage('Error fetching config details: ' + error.message);
            }
        } else {
            setTargetDbConnection({
                host: '',
                user: '',
                password: '',
                port: ''
            });
            setDatabase(''); // Reset database input when no configuration is selected
        }
    };

    const handleRestore = () => {
        setShowReview(true);
    };

    const cancelRestore = () => {
        setShowReview(false);
    };

    const confirmRestore = async () => {
        if (!selectedConfig || !selectedBackup) {
            alert('Please select a configuration and a backup.');
            return;
        }
        if (!database) {
            alert('Please enter a database name.');
            return;
        }
        setLoading(true); // Set loading to true before starting the restore
        try {
            const response = await axios.post('http://localhost:3000/restore', {
                source_backup_file: selectedBackup,
                target_db_connection: {
                    ...targetDbConnection,
                    database // Add database to the connection object
                },
                fullRestore: fullRestore
            });
            alert(response.data);
        } catch (error) {
            toast.error('Error during restore:', error);
            if (error.message.includes === 'ETIMEDOUT') {
                alert('Error during restore: Connection timed out')
            } else {
                alert(error)
            }
        } finally {
            setLoading(false); // Set loading to false after restore completes
        }
        setShowReview(false);
    };

    return (
        <div>
            <ToastContainer position="top-right" autoClose={5000} />
            {loading && <Loading />}
            {!loading && (
                <>
                    {showReview ? (
                        <Review
                            details={{
                                'Host': targetDbConnection.host,
                                'User': targetDbConnection.user,
                                'Password': targetDbConnection.password,
                                'Database': database, // Include database in review details
                                'Port': targetDbConnection.port,
                                'BackupFile': selectedBackup
                            }}
                            onConfirm={confirmRestore}
                            onCancel={cancelRestore}
                            type="Restore"
                        />
                    ) : (
                        <>
                            <h2>Restore</h2>
                            <InfoBox message="Bu sayfa, veritabanınızı seçilen yedek dosyasına geri yüklemek için kullanılır. Lütfen dikkatli olun ve doğru yedek dosyasını seçtiğinizden emin olun." />
                            {errorMessage && <div className="error">{errorMessage}</div>}
                            <div>
                                <label>Configuration:</label>
                                <select value={selectedConfig} onChange={handleConfigChange}>
                                    <option value="">Select Configuration</option>
                                    {configurations.map(config => (
                                        <option key={config.config_name} value={config.config_name}>
                                            {config.config_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label>Database:</label>
                                <input
                                    type="text"
                                    value={database}
                                    onChange={(e) => setDatabase(e.target.value)}
                                    required
                                />
                            </div>
                            <div style={{ display: "inline" }}>
                                <label>Backup File:</label>
                                <select value={selectedBackup} onChange={e => setSelectedBackup(e.target.value)}>
                                    <option value="">Select Backup</option>
                                    {backupFiles.map(file => (
                                        <option key={file} value={file}>{file}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: "inline", marginLeft: '20px' }}>
                                <label>
                                    <input
                                        type='checkbox'
                                        checked={fullRestore}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                if (window.confirm('The database will be deleted and restored, data loss may occur')) {
                                                    setFullRestore(true);
                                                }
                                            } else {
                                                setFullRestore(false);
                                            }
                                        }}
                                    />
                                    DROP DATABASE
                                </label>
                            </div>
                            {selectedConfig && selectedBackup && (
                                <div className="config-card">
                                    <p><strong>Host:</strong> {targetDbConnection.host}</p>
                                    <p><strong>User:</strong> {targetDbConnection.user}</p>
                                    <p><strong>Password:</strong> {targetDbConnection.password}</p>
                                    <p><strong>Port:</strong> {targetDbConnection.port}</p>
                                    <p><strong>Backup File:</strong> {selectedBackup}</p>
                                    <button onClick={handleRestore}>Restore</button>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export default Restore;
