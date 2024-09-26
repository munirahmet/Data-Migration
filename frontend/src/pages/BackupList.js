import React, { useState, useEffect } from 'react';
import axios from 'axios';
import InfoBox from '../components/InfoBox'; // InfoBox bileşenini doğru klasörden içe aktarıyoruz

const BackupList = () => {
    const [backups, setBackups] = useState([]);

    useEffect(() => {
        axios.get('http://localhost:3000/backup_list')
            .then(response => setBackups(response.data))
            .catch(error => {
                console.error('Error during backup list:', error);
                if (error.response) {
                    alert('Error during backup list: ' + error.response.data);
                } else {
                    alert('Error during backup list: ' + error.message);
                }
            });
    }, []);

    return (
        <div>
            <h2>Dump List</h2>
            <InfoBox message="Bu sayfa, mevcut yedek dosyalarını listelemektedir. Yedek dosyaları, veritabanınızın önceki durumlarını geri yüklemek için kullanılır ve düzenli aralıklarla alınması önerilir." />
            <ul>
                {backups.map(backup => (
                    <li key={backup}>{backup}</li>
                ))}
            </ul>
        </div>
    );
};

export default BackupList;
