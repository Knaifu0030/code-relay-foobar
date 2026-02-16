import React from 'react';
import PropTypes from 'prop-types';
import { Trash2, Check, Clock } from 'lucide-react';
import Button from '../UI/Button';

const TaskItem = ({ task, onDelete, onToggle }) => {
    return (
        <div className="task-item fade-in">
            <div className="task-content">
                <div
                    className={`checkbox ${task.completed ? 'checked' : ''}`}
                    onClick={() => onToggle(task.id)}
                >
                    {task.completed && <Check size={14} color="white" />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className={task.completed ? 'strikethrough' : ''} style={{ fontWeight: '500', fontSize: '1.1rem' }}>
                        {task.title}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                        <Clock size={12} color="#666" />
                        <span style={{ fontSize: '0.75rem', color: '#666' }}>
                            {new Date(task.created_at).toLocaleDateString()
            </span>
                    </div>
                </div>
            </div>
            <Button
                onClick={() => onDelete(task.id)}
                variant="danger"
                className="danger"
                style={{ padding: '0.6rem' }}
            >
                <Trash2 size={18} />
            </Button>
        </div>
    );

    TaskItem.propTypes = {
        task: PropTypes.shape({
            id: PropTypes.string.isRequired,
            title: PropTypes.string.isRequired,
            completed: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]).isRequired,
            created_at: PropTypes.string
        }).isRequired,
        onDelete: PropTypes.func.isRequired,
        onToggle: PropTypes.func.isRequired
    };
