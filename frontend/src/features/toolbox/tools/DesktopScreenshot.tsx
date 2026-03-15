import React, { useState } from 'react';
import { Button, message } from 'antd';
import { CaptureScreenshot } from '../../../../wailsjs/go/screenshot/ScreenshotService';

const DesktopScreenshot: React.FC = () => {
    const [loading, setLoading] = useState<'region' | 'window' | null>(null);

    const capture = async (mode: 'region' | 'window') => {
        setLoading(mode);
        try {
            await CaptureScreenshot(mode);
            message.success('已复制到剪贴板');
        } catch (e: any) {
            const msg = e?.message || '截图失败';
            if (msg.includes('已取消')) { message.info(msg); } else { message.error(msg); }
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="screenshot-tool">
            <div className="screenshot-actions">
                <Button type="primary" loading={loading === 'region'} onClick={() => capture('region')}>选区截图</Button>
                <Button loading={loading === 'window'} onClick={() => capture('window')}>窗口截图</Button>
            </div>
            <div className="screenshot-hint">完成后已复制到剪贴板，可直接粘贴。</div>
            <div className="screenshot-hint muted">按 Esc 取消截图。</div>
        </div>
    );
};

export default DesktopScreenshot;
