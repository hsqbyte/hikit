import React, { useState, useEffect } from 'react';

const RegexTester: React.FC = () => {
    const [pattern, setPattern] = useState('');
    const [flags, setFlags] = useState({ g: true, i: false, m: false });
    const [testText, setTestText] = useState('');
    const [matchCount, setMatchCount] = useState(0);
    const [highlighted, setHighlighted] = useState<React.ReactNode>('');

    useEffect(() => {
        if (!pattern || !testText) { setHighlighted(testText); setMatchCount(0); return; }
        try {
            const flagStr = Object.entries(flags).filter(([, v]) => v).map(([k]) => k).join('');
            const regex = new RegExp(pattern, flagStr);
            let count = 0;
            const parts: React.ReactNode[] = [];
            let lastIndex = 0;
            let match: RegExpExecArray | null;

            if (flags.g) {
                while ((match = regex.exec(testText)) !== null) {
                    if (match.index > lastIndex) parts.push(testText.slice(lastIndex, match.index));
                    parts.push(<mark key={count}>{match[0]}</mark>);
                    lastIndex = match.index + match[0].length;
                    count++;
                    if (match[0].length === 0) { regex.lastIndex++; }
                }
            } else {
                match = regex.exec(testText);
                if (match) {
                    if (match.index > 0) parts.push(testText.slice(0, match.index));
                    parts.push(<mark key={0}>{match[0]}</mark>);
                    lastIndex = match.index + match[0].length;
                    count = 1;
                }
            }
            if (lastIndex < testText.length) parts.push(testText.slice(lastIndex));
            setHighlighted(<>{parts}</>);
            setMatchCount(count);
        } catch {
            setHighlighted(testText);
            setMatchCount(0);
        }
    }, [pattern, testText, flags]);

    const toggleFlag = (f: 'g' | 'i' | 'm') => setFlags(prev => ({ ...prev, [f]: !prev[f] }));

    return (
        <>
            <div className="regex-input-row">
                <input className="regex-input" value={pattern} onChange={(e) => setPattern(e.target.value)}
                    placeholder="输入正则表达式..." spellCheck={false} />
                <div className="regex-flags">
                    {(['g', 'i', 'm'] as const).map(f => (
                        <button key={f} className={`regex-flag-btn ${flags[f] ? 'active' : ''}`} onClick={() => toggleFlag(f)}>{f}</button>
                    ))}
                </div>
            </div>
            <span className="tool-label">测试文本</span>
            <textarea className="tool-textarea" value={testText} onChange={(e) => setTestText(e.target.value)}
                placeholder="输入要测试的文本..." spellCheck={false} />
            <span className="tool-label">匹配结果</span>
            <div className="regex-match-result">{highlighted}</div>
            <div className="regex-match-info">
                {matchCount > 0 ? `✅ 匹配到 ${matchCount} 处` : pattern ? '❌ 无匹配' : ''}
            </div>
        </>
    );
};

export default RegexTester;
