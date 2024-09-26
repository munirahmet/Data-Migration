import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ConfigManager.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ConfigManager = () => {
  const [configurations, setConfigurations] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState('');
  const [configDetails, setConfigDetails] = useState({
    config_name: '',
    host: '',
    user: '',
    password: '',
    port: ''
  });
  const [originalConfigName, setOriginalConfigName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchConfigurations();
  }, []);

  const fetchConfigurations = async () => {
    try {
      const response = await axios.get('http://localhost:3000/configurations');
      setConfigurations(response.data);
    } catch (error) {
      toast.error('Error fetching configurations:', error);
    }
  };

  const handleConfigChange = async (e) => {
    const configKey = e.target.value;
    setSelectedConfig(configKey);
    if (configKey) {
      try {
        const response = await axios.get(`http://localhost:3000/config_details?configKey=${configKey}`);
        setConfigDetails(response.data);
        setOriginalConfigName(response.data.config_name);
        setIsEditing(true);
      } catch (error) {
        toast.error('Error fetching configuration details:', error);
      }
    } else {
      resetForm();
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setConfigDetails(prevDetails => ({ ...prevDetails, [name]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put('http://localhost:3000/update_configuration', { ...configDetails, original_config_name: originalConfigName });
        toast.success('Configuration updated successfully');
      } else {
        await axios.post('http://localhost:3000/add_configuration', configDetails);
        toast.success('Configuration added successfully');
      }
      fetchConfigurations();
      resetForm();
    } catch (error) {
      toast.error('Error saving configuration:', error);
      if (error.response && error.response.status === 400) {
        toast.warning('A configuration with the same name already exists');
      } else {
        toast.error('Error saving configuration');
      }
    }
  };

  const handleDelete = async () => {
    if (selectedConfig) {
      try {
        await axios.delete('http://localhost:3000/delete_configuration', { data: { config_name: selectedConfig } });
        fetchConfigurations();
        resetForm();
        toast.success('Configuration deleted successfully');
      } catch (error) {
        toast.error('Error deleting configuration:', error);
      }
    }
  };

  const resetForm = () => {
    setConfigDetails({
      config_name: '',
      host: '',
      user: '',
      password: '',
      port: ''
    });
    setSelectedConfig('');
    setIsEditing(false);
    setErrorMessage('');
  };

  return (
    <div>
      <h2>Configuration Manager</h2>
      <ToastContainer position="top-right" autoClose={5000} />
      <div>
        <label>Configuration:</label>
        <select onChange={handleConfigChange} value={selectedConfig}>
          <option value="">Add New Configuration</option>
          {configurations.map(config => (
            <option key={config.config_name} value={config.config_name}>
              {config.config_name}
            </option>
          ))}
        </select>
      </div>
      <form onSubmit={handleFormSubmit}>
        <div>
          <label>Config Name:</label>
          <input type="text" name="config_name" value={configDetails.config_name} onChange={handleInputChange} required />
        </div>
        <div>
          <label>Host:</label>
          <input type="text" name="host" value={configDetails.host} onChange={handleInputChange} required />
        </div>
        <div>
          <label>User:</label>
          <input type="text" name="user" value={configDetails.user} onChange={handleInputChange} required />
        </div>
        <div>
          <label>Password:</label>
          <input type="password" name="password" value={configDetails.password} onChange={handleInputChange} required />
        </div>
        <div>
          <label>Port:</label>
          <input type="text" name="port" value={configDetails.port} onChange={handleInputChange} required />
        </div>
        <div>
          <button type="submit">{isEditing ? 'Update' : 'Add'}</button>
          {isEditing && <button type="button" onClick={handleDelete}>Delete</button>}
        </div>
      </form>
      {errorMessage && <div className="error">{errorMessage}</div>}
    </div>
  );
};

export default ConfigManager;
