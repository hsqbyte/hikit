import React, { useState } from 'react';

const DEFAULT_MD = `# Markdown 预览

这是一个 **实时 Markdown 预览** 工具。

## 支持的语法

- **加粗** 和 *斜体*
- \`行内代码\`
- [链接](https://example.com)
- 列表项

### 代码块

\`\`\`javascript
function hello() {
    console.log("Hello, HiKit!");
}
\`\`\`

> 引用文本

| 名称 | 说明 |
|------|------|
| HiKit | 开发工具箱 |
| SSH | 远程连接 |

---

1. 有序列表
2. 第二项
3. 第三项
`;

const renderMarkdown = (text: string): string => {
    let html = text;
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/^---$/gm, '<hr/>');
    html = html.replace(/^\|(.+)\|\s*\n\|[-| ]+\|\s*\n((?:\|.+\|\s*\n)*)/gm, (_, header, body) => {
        const ths = header.split('|').map((h: string) => `<th>${h.trim()}</th>`).join('');
        const rows = body.trim().split('\n').map((row: string) => {
            const tds = row.replace(/^\||\|$/g, '').split('|').map((c: string) => `<td>${c.trim()}</td>`).join('');
            return `<tr>${tds}</tr>`;
        }).join('');
        return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
    });
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.+<\/li>\s*)+)/g, '<ul>$1</ul>');
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^(?!<[hupbloiat]|<\/|<li|<hr)(.+)$/gm, '<p>$1</p>');
    return html;
};

const MarkdownPreview: React.FC = () => {
    const [md, setMd] = useState(DEFAULT_MD);

    return (
        <div className="markdown-container">
            <textarea className="markdown-editor" value={md} onChange={(e) => setMd(e.target.value)}
                placeholder="在这里输入 Markdown..." spellCheck={false} />
            <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(md) }} />
        </div>
    );
};

export default MarkdownPreview;
