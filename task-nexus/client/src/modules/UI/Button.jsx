import React from 'react';

const Button = ({ children, onClick, variant = 'primary', icon: Icon, disabled, ...props }) => {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`btn-${variant}`}
            {...props}
        >
            {Icon && <Icon size={18} />}
            {children}
        </button>
    );
};

export default Button;
