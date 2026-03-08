import React from 'react';
import './MusicPanel.css';

const MusicView: React.FC = () => {
    return (
        <div className="music-view">
            <iframe
                src="http://localhost:19528"
                title="Music Player"
                allow="autoplay"
            />
        </div>
    );
};

export default MusicView;
