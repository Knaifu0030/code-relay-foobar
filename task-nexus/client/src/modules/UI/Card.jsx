import React from 'react';

const Card = ({ children, className = '' }) => {
    return (
        <div className={`card glass fade-in ${className}`}>
            {children}
        </div>
    );
};

export default Card;
