import React from 'react';
import { toolList } from './ToolboxPanel';
import JsonFormatter from '../tools/JsonFormatter';
import EncoderDecoder from '../tools/EncoderDecoder';
import TimestampConverter from '../tools/TimestampConverter';
import HashCalculator from '../tools/HashCalculator';
import RegexTester from '../tools/RegexTester';
import DiffTool from '../tools/DiffTool';
import JwtDecoder from '../tools/JwtDecoder';
import UuidGenerator from '../tools/UuidGenerator';
import CronParser from '../tools/CronParser';
import ColorTool from '../tools/ColorTool';
import IpNetworkTool from '../tools/IpNetworkTool';
import QrCodeGenerator from '../tools/QrCodeGenerator';
import ImageTool from '../tools/ImageTool';
import TextTool from '../tools/TextTool';
import MarkdownPreview from '../tools/MarkdownPreview';
import DesktopScreenshot from '../tools/DesktopScreenshot';
import PortScanner from '../tools/PortScanner';
import './ToolboxView.css';

interface ToolboxViewProps {
    toolKey: string;
}

const renderTool = (toolKey: string) => {
    switch (toolKey) {
        case 'json_formatter': return <JsonFormatter />;
        case 'encoder':        return <EncoderDecoder />;
        case 'timestamp':      return <TimestampConverter />;
        case 'hash':           return <HashCalculator />;
        case 'regex':          return <RegexTester />;
        case 'diff':           return <DiffTool />;
        case 'jwt':            return <JwtDecoder />;
        case 'uuid':           return <UuidGenerator />;
        case 'cron':           return <CronParser />;
        case 'color':          return <ColorTool />;
        case 'ip_network':     return <IpNetworkTool />;
        case 'qrcode':         return <QrCodeGenerator />;
        case 'image_tool':     return <ImageTool />;
        case 'text_tool':      return <TextTool />;
        case 'markdown':       return <MarkdownPreview />;
        case 'screenshot':     return <DesktopScreenshot />;
        case 'port_scan':      return <PortScanner />;
        default: return <div style={{ color: '#999', textAlign: 'center', padding: 40 }}>暂未实现</div>;
    }
};

const ToolboxView: React.FC<ToolboxViewProps> = ({ toolKey }) => {
    const tool = toolList.find(t => t.key === toolKey);
    return (
        <div className="toolbox-view">
            <div className="toolbox-view-header">
                {tool && <span className={`toolbox-card-icon ${tool.colorClass}`}>{tool.icon}</span>}
                <h3>{tool?.name || '工具'}</h3>
            </div>
            <div className="toolbox-view-body">
                {renderTool(toolKey)}
            </div>
        </div>
    );
};

export default ToolboxView;
