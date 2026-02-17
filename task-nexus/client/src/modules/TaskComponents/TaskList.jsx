import React from 'react';
import TaskItem from './TaskItem';

const TaskList = ({ quantumTasks, onPurge, onToggleNexus }) => {
    if (quantumTasks === null) {
        return <div className="loading">Nexus Syncing...</div>;
    }

    return (
        <div className="task-list">
            {quantumTasks.map(task => (
                <TaskItem
                    key={task.id}
                    task={task}
                    onDelete={onPurge}
                    onToggle={onToggleNexus}
                />
            ))}
        </div>
    );
};

export default TaskList;
