import React, { useState, useRef } from 'react';
import { Button, Select, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

const ImageTool: React.FC = () => {
    const [imgSrc, setImgSrc] = useState('');
    const [imgInfo, setImgInfo] = useState<{ name: string; size: number; type: string; width: number; height: number } | null>(null);
    const [base64, setBase64] = useState('');
    const [quality, setQuality] = useState(0.8);
    const [outputFormat, setOutputFormat] = useState('image/jpeg');
    const [compressedSize, setCompressedSize] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const src = e.target?.result as string;
            setImgSrc(src); setBase64(src);
            const img = new Image();
            img.onload = () => setImgInfo({ name: file.name, size: file.size, type: file.type, width: img.width, height: img.height });
            img.src = src;
        };
        reader.readAsDataURL(file);
    };

    const compress = () => {
        if (!imgSrc) return;
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            canvas.getContext('2d')?.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL(outputFormat, quality);
            setBase64(dataUrl);
            setCompressedSize(Math.round(dataUrl.length * 0.75));
        };
        img.src = imgSrc;
    };

    const downloadCompressed = () => {
        const a = document.createElement('a');
        a.href = base64; a.download = `compressed.${outputFormat.split('/')[1]}`; a.click();
    };

    return (
        <>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <div className={`image-drop-zone ${imgSrc ? 'has-image' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]); }}>
                {imgSrc ? (
                    <img src={imgSrc} alt="preview" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 6 }} />
                ) : (
                    <div style={{ color: '#999' }}>📁 点击选择或拖拽图片到这里</div>
                )}
            </div>
            {imgInfo && (
                <>
                    <div className="image-info-grid">
                        <div className="image-info-card">
                            <h4>原始信息</h4>
                            <div style={{ fontSize: 12, color: '#666' }}>
                                <div>{imgInfo.name}</div>
                                <div>{imgInfo.width} × {imgInfo.height}px</div>
                                <div>{(imgInfo.size / 1024).toFixed(1)} KB ({imgInfo.type})</div>
                            </div>
                        </div>
                        <div className="image-info-card">
                            <h4>压缩 / 转换</h4>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <Select value={outputFormat} onChange={setOutputFormat} size="small"
                                    options={[
                                        { value: 'image/jpeg', label: 'JPEG' },
                                        { value: 'image/png', label: 'PNG' },
                                        { value: 'image/webp', label: 'WebP' },
                                    ]} />
                                <span style={{ fontSize: 12 }}>质量: {Math.round(quality * 100)}%</span>
                                <input type="range" min="0.1" max="1" step="0.05" value={quality}
                                    onChange={(e) => setQuality(parseFloat(e.target.value))} style={{ width: 80 }} />
                                <Button size="small" type="primary" onClick={compress}>压缩</Button>
                                <Button size="small" onClick={downloadCompressed}>下载</Button>
                            </div>
                            {compressedSize > 0 && (
                                <div style={{ fontSize: 12, color: '#52c41a', marginTop: 4 }}>
                                    压缩后: {(compressedSize / 1024).toFixed(1)} KB ({Math.round((1 - compressedSize / imgInfo.size) * 100)}% 减少)
                                </div>
                            )}
                        </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                        <Button size="small" icon={<CopyOutlined />}
                            onClick={() => { navigator.clipboard.writeText(base64); message.success('Base64 已复制'); }}>复制 Base64</Button>
                    </div>
                </>
            )}
        </>
    );
};

export default ImageTool;
