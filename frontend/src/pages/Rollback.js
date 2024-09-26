import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Loading from './Loading';
import Review from './Review';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import InfoBox from '../components/InfoBox';

const Rollback = () => {
    const [configurations, setConfigurations] = useState([]);
    const [selectedConfig, setSelectedConfig] = useState('');
    const [database, setDatabase] = useState('');
    const [targetDbConnection, setTargetDbConnection] = useState({});
    const [currentVersion, setCurrentVersion] = useState('');
    const [rollbackScripts, setRollbackScripts] = useState([]);
    const [toVersion, setToVersion] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [showReview, setShowReview] = useState(false);
    const [executedScripts, setExecutedScripts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [dbSelected, setDbSelected] = useState(false);

    useEffect(() => {
        axios.get('http://localhost:3000/configurations')
            .then(response => setConfigurations(response.data))
            .catch(error => toast.error('Error fetching configurations:', error));

        axios.get('http://localhost:3000/rollback_list')
            .then(response => {
                const versions = response.data.map(script => script.match(/\d+(\.\d+)+/)[0]);
                setRollbackScripts(versions);
            })
            .catch(error => toast.error('Error fetching rollback scripts:', error));
    }, []);

    const handleConfigChange = async (e) => {
        setSelectedConfig(e.target.value);
        setDatabase('');
        setCurrentVersion('');
        setDbSelected(false);
    };

    const handleDbSelect = async () => {
        if (!selectedConfig || !database) {
            alert('Please select a configuration and enter a database name');
            return;
        }
        setLoading(true);
        try {
            const configDetails = await axios.get(`http://localhost:3000/config_details?configKey=${selectedConfig}`);
            setTargetDbConnection({ ...configDetails.data, database });

            const currentVersionResponse = await axios.get(`http://localhost:3000/current_version?configName=${selectedConfig}&database=${database}`);
            setCurrentVersion(currentVersionResponse.data.version);
            setDbSelected(true);
        } catch (error) {
            if (error.response && error.response.status === 404) {
                setCurrentVersion('1.0.0');
            } else {
                toast.error('Error fetching current version');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRollback = async () => {
        setErrorMessage('');
        if (!selectedConfig) {
            alert('Please select a configuration');
            return;
        }
        if (!database) {
            alert('Please enter a database name.');
            return;
        }
        if (!toVersion) {
            alert('Please select a target version');
            return;
        }
        if (currentVersion <= toVersion) {
            alert('Cannot roll back to the same or a later version!');
            return;
        }
        setShowReview(true);
    };

    const confirmRollback = async () => {
        setLoading(true);
        try {
            const response = await axios.post('http://localhost:3000/check_rollback_files', {
                from: currentVersion,
                to: toVersion
            });

            if (response.data.success) {
                try {
                    const rollbackResponse = await axios.post('http://localhost:3000/rollback', {
                        from: currentVersion,
                        to: toVersion,
                        target_db_connection: targetDbConnection,
                        configName: selectedConfig
                    });
                    setExecutedScripts(rollbackResponse.data.executedScripts);
                    alert(`Successfully rolled back from v${currentVersion} to v${toVersion}`);
                    setCurrentVersion(toVersion);
                } catch (error) {
                    toast.error(error);
                    setErrorMessage(`Error rolling back from v${currentVersion} to v${toVersion}: ${error.response ? error.response.data : error.message}`);
                }
            } else {
                setErrorMessage(response.data.message);
            }
        } catch (error) {
            setErrorMessage('Error checking rollback files: ' + error.message);
        } finally {
            setLoading(false);
        }
        setShowReview(false);
    };

    const cancelRollback = () => {
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
                                'From Version': currentVersion,
                                'To Version': toVersion,
                                'Host': targetDbConnection.host,
                                'User': targetDbConnection.user,
                                'Password': targetDbConnection.password,
                                'Database': database,
                                'Port': targetDbConnection.port,
                            }}
                            onConfirm={confirmRollback}
                            onCancel={cancelRollback}
                            type="Rollback"
                        />
                    ) : (
                        <>
                            <h2>Rollback</h2>
                            <InfoBox message="Bu sayfa, veritabanı sürümünü önceki bir sürüme geri almak için kullanılır. Lütfen dikkatli olun ve doğru sürümü seçtiğinizden emin olun." />
                            <div>
                                <label>Configuration:</label>
                                <select onChange={handleConfigChange} value={selectedConfig}>
                                    <option value="">Select Configuration</option>
                                    {configurations.map(config => (
                                        <option key={config.config_name} value={config.config_name}>
                                            {config.config_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedConfig && (
                                <>
                                    <div>
                                        <label>Database:</label>
                                        <input
                                            type="text"
                                            value={database}
                                            onChange={(e) => setDatabase(e.target.value)}
                                            required
                                        />
                                        <button onClick={handleDbSelect}>Seç</button>
                                    </div>
                                    {dbSelected && (
                                        <>
                                            <div className="version">
                                                <label>Current Version: <b>{currentVersion}</b></label>
                                                <label className='label-to'>To:</label>
                                                <select
                                                    value={toVersion}
                                                    onChange={(e) => setToVersion(e.target.value)}
                                                >
                                                    <option value="">Select Target Version</option>
                                                    {rollbackScripts.map(script => (
                                                        <option key={script} value={script}>{script}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="config-card">
                                                <p><strong>Host:</strong> {targetDbConnection.host}</p>
                                                <p><strong>User:</strong> {targetDbConnection.user}</p>
                                                <p><strong>Password:</strong> {targetDbConnection.password}</p>
                                                <p><strong>Port:</strong> {targetDbConnection.port}</p>
                                                <button onClick={handleRollback}>Rollback</button>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                            {errorMessage && <div className="error">{errorMessage}</div>}
                            {executedScripts && <pre className="exec">{executedScripts.join('\n')}</pre>}
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export default Rollback;
