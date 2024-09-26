import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import InfoBox from '../components/InfoBox'; // InfoBox bileşenini doğru klasörden içe aktarıyoruz

const FileEditor = () => {
    const [fileType, setFileType] = useState('migration');
    const [files, setFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState('');
    const [fileContent, setFileContent] = useState('');
    const [version, setVersion] = useState('');
    const [isNewFile, setIsNewFile] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const fetchFileList = useCallback(() => {
        setIsLoading(true);
        axios.get(`http://localhost:3000/${fileType}_list`)
            .then(response => {
                const sortedFiles = response.data.sort();
                setFiles(sortedFiles);
                setIsLoading(false);
            })
            .catch(error => {
                toast.error('Error fetching file list:', error);
                setIsLoading(false);
            });
    }, [fileType]);

    useEffect(() => {
        fetchFileList();
    }, [fileType, fetchFileList]);

    const handleFileSelect = (e) => {
        if (isNewFile && isDirty) {
            const confirm = window.confirm('You have unsaved changes. Do you want to save the file?');
            if (confirm) {
                handleSave();
            } else {
                setFiles(files.filter(file => file !== selectedFile));
                setSelectedFile('');
                setFileContent('');
                setIsNewFile(false);
                setIsDirty(false);
                return;
            }
        }
        const fileName = e.target.value;
        setSelectedFile(fileName);
        setIsNewFile(false);
        setIsDirty(false);
        if (fileName) {
            axios.get(`http://localhost:3000/get_script`, {
                params: { file: fileName, type: fileType }
            })
                .then(response => setFileContent(response.data))
                .catch(error => toast.error('Error fetching file content:', error));
        } else {
            setFileContent('');
        }
    };

    const handleSave = () => {
        if (!selectedFile) {
            toast.error('Please select or create a file first.');
            return;
        }

        axios.post('http://localhost:3000/save_script', { fileName: selectedFile, fileContent, fileType, isNewFile })
            .then(response => {
                toast.success(response.data);
                fetchFileList();
                setIsNewFile(false);
                setIsDirty(false);
            })
            .catch(error => toast.error('Error saving file: ' + error.response.data));
    };

    const handleCreateNewFile = () => {
        if (!version) {
            toast.error('Please enter a version.');
            return;
        }

        const newFile = `${fileType}_v${version}.sql`;
        if (files.includes(newFile)) {
            toast.error('A file with the same name already exists.');
        } else {
            setSelectedFile(newFile);
            setFileContent(`-- ${fileType} script for version ${version}`);
            setFiles([...files, newFile].sort());
            setIsNewFile(true);
            setIsDirty(true);
            toast.success('File created successfully.');
        }
    };

    const handleDelete = () => {
        if (!isNewFile) {
            axios.post('http://localhost:3000/delete_script', { fileName: selectedFile, fileType })
                .then(response => {
                    toast.success(response.data);
                    setSelectedFile('');
                    setFileContent('');
                    fetchFileList();
                    setIsNewFile(false);
                    setIsDirty(false);
                })
                .catch(error => toast.error('Error deleting file: ' + error.response.data));
        } else {
            setFiles(files.filter(file => file !== selectedFile));
            setSelectedFile('');
            setFileContent('');
            setIsNewFile(false);
            setIsDirty(false);
            toast.success('Unsaved file discarded.');
        }
    };

    const handleRadioChange = (e) => {
        if (isNewFile && isDirty) {
            const confirm = window.confirm('You have unsaved changes. Do you want to save the file?');
            if (confirm) {
                handleSave();
            } else {
                setFiles(files.filter(file => file !== selectedFile));
                setSelectedFile('');
                setFileContent('');
                setIsNewFile(false);
                setIsDirty(false);
            }
        }
        const newFileType = e.target.value;
        setFileType(newFileType);
        setSelectedFile('');
        setFiles([]);
        setVersion('');
        setIsDirty(false);
        fetchFileList();
    };

    return (
        <div>
            <h2 style={{ display: "inline" }}>File Editor</h2>
            <ToastContainer position="top-right" autoClose={5000} />
            <InfoBox message="Bu sayfa, migration veya rollback script dosyalarını oluşturmanıza, düzenlemenize ve silmenize olanak tanır. Dosyaları veya türleri değiştirmeden önce değişikliklerinizi kaydettiğinizden emin olun." />
            <div style={{ marginTop: "20px" }}>
                <label>
                    <input
                        type="radio"
                        name="fileType"
                        value="migration"
                        checked={fileType === 'migration'}
                        onChange={handleRadioChange}
                    />
                    Migration
                </label>
                <label>
                    <input
                        type="radio"
                        name="fileType"
                        value="rollback"
                        checked={fileType === 'rollback'}
                        onChange={handleRadioChange}
                    />
                    Rollback
                </label>
            </div>
            <div className='fe-select'>
                <select value={selectedFile} onChange={handleFileSelect} disabled={isLoading}>
                    <option value="">Select a file</option>
                    {files.map(file => (
                        <option key={file} value={file}>
                            {file}
                        </option>
                    ))}
                </select>
            </div>
            <div className='version-fe'>
                <label style={{ display: "inline" }}>Version:</label>
                <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                />
            </div>
            <div className='new-file'>
                <button onClick={handleCreateNewFile}>Create New File</button>
            </div>
            {selectedFile && (
                <div>
                    <h3>Editing: {selectedFile}</h3>
                    <textarea
                        value={fileContent}
                        onChange={e => {
                            setFileContent(e.target.value);
                            setIsDirty(true);
                        }}
                        rows="20"
                        cols="80"
                    />
                    <div>
                        <button onClick={handleSave}>Save</button>
                        <button onClick={handleDelete}>Delete</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileEditor;
