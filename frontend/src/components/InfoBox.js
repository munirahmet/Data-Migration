import React from 'react';
import './InfoBox.css';

const InfoBox = ({ message }) => {
    return (
        <div className="info-box">
            <p>{message}</p>
        </div>
    );
};

export default InfoBox;
