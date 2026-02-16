import React from 'react';

const Input = ({ value, onChange, placeholder, disabled, ...props }) => {
    return (
        <input
            type="text"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            {...props}
        />
    );
};

export default Input;
