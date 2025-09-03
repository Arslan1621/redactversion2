import React, { useState, useRef, useCallback, useEffect } from 'react';

interface Suggestion {
  text: string;
  type: string;
  index: number;
}

interface RedactionHistory {
  content: string;
  count: number;
}

const DocumentRedactionTool: React.FC = () => {
  const [originalContent, setOriginalContent] = useState<string>('');
  const [currentContent, setCurrentContent] = useState<string>('');
  const [redactionHistory, setRedactionHistory] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [redactionCount, setRedactionCount] = useState<number>(0);
  const [filename, setFilename] = useState<string>('');
  const [selectedText, setSelectedText] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentViewerRef = useRef<HTMLDivElement>(null);

  const showStatus = useCallback((message: string, type: string) => {
    setStatusMessage({ text: message, type });
    setTimeout(() => setStatusMessage(null), 3000);
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFilename(file.name.replace('.docx', ''));
    
    try {
      showStatus('Loading document...', 'info');
      
      const arrayBuffer = await file.arrayBuffer();
      // @ts-ignore - mammoth is loaded via CDN
      const result = await window.mammoth.convertToHtml({arrayBuffer: arrayBuffer});
      
      const content = result.value;
      setOriginalContent(content);
      setCurrentContent(content);
      
      showStatus('Document loaded successfully!', 'success');
    } catch (error) {
      console.error('Error loading document:', error);
      showStatus('Error loading document. Please try again.', 'error');
    }
  }, [showStatus]);

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    const selected = selection?.toString().trim() || '';
    setSelectedText(selected);
  }, []);

  const redactSelected = useCallback(() => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    
    if (!selectedText || !documentViewerRef.current) return;

    // Save current state for undo
    setRedactionHistory(prev => [...prev, currentContent]);

    // Create redaction blocks
    const redactionBlocks = '█'.repeat(Math.max(1, Math.ceil(selectedText.length / 3)));
    
    // Replace selected text with redaction blocks
    const range = selection?.getRangeAt(0);
    if (range) {
      const redactedSpan = document.createElement('span');
      redactedSpan.className = 'redacted-text';
      redactedSpan.textContent = redactionBlocks;
      redactedSpan.setAttribute('data-original', selectedText);
      
      range.deleteContents();
      range.insertNode(redactedSpan);
      
      // Update current content
      setCurrentContent(documentViewerRef.current.innerHTML);
      selection?.removeAllRanges();
      setRedactionCount(prev => prev + 1);
      setSelectedText('');
    }
  }, [currentContent]);

  const generateSuggestions = useCallback(() => {
    if (!documentViewerRef.current) return;
    
    const text = documentViewerRef.current.textContent || documentViewerRef.current.innerText;
    
    const patterns = [
      { type: 'Email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
      { type: 'Phone', regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g },
      { type: 'SSN', regex: /\b\d{3}-?\d{2}-?\d{4}\b/g },
      { type: 'Date', regex: /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g },
      { type: 'Name', regex: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g }
    ];

    const newSuggestions: Suggestion[] = [];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        newSuggestions.push({
          text: match[0],
          type: pattern.type,
          index: match.index
        });
      }
    });

    setSuggestions(newSuggestions);
  }, []);

  const acceptSuggestion = useCallback((index: number) => {
    const suggestion = suggestions[index];
    if (!documentViewerRef.current) return;
    
    // Save current state for undo
    setRedactionHistory(prev => [...prev, currentContent]);
    
    // Find and replace the text
    const redactionBlocks = '█'.repeat(Math.max(1, Math.ceil(suggestion.text.length / 3)));
    const redactedSpan = `<span class="redacted-text" data-original="${suggestion.text}">${redactionBlocks}</span>`;
    
    const newContent = currentContent.replace(suggestion.text, redactedSpan);
    setCurrentContent(newContent);
    
    setRedactionCount(prev => prev + 1);
    setSuggestions(prev => prev.filter((_, i) => i !== index));
  }, [suggestions, currentContent]);

  const rejectSuggestion = useCallback((index: number) => {
    setSuggestions(prev => prev.filter((_, i) => i !== index));
  }, []);

  const undoRedaction = useCallback(() => {
    if (redactionHistory.length > 0) {
      const lastState = redactionHistory[redactionHistory.length - 1];
      setCurrentContent(lastState);
      setRedactionHistory(prev => prev.slice(0, -1));
      setRedactionCount(prev => Math.max(0, prev - 1));
    }
  }, [redactionHistory]);

  const clearAllRedactions = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all redactions?')) {
      setCurrentContent(originalContent);
      setRedactionCount(0);
      setRedactionHistory([]);
      setSuggestions([]);
    }
  }, [originalContent]);

  const downloadDocx = useCallback(() => {
    try {
      if (!documentViewerRef.current) return;
      
      // Create a clean copy of the content for export
      const exportContent = documentViewerRef.current.cloneNode(true) as HTMLElement;
      
      // Process redacted elements
      const redactedElements = exportContent.querySelectorAll('.redacted-text');
      redactedElements.forEach(el => {
        const original = el.getAttribute('data-original') || '';
        const blocks = '█'.repeat(Math.max(3, Math.ceil(original.length / 3)));
        el.textContent = blocks;
        (el as HTMLElement).style.backgroundColor = 'transparent';
        (el as HTMLElement).style.color = 'black';
      });
      
      // Create Word-compatible HTML
      const wordCompatibleHtml = `
<!DOCTYPE html>
<html xmlns:v="urn:schemas-microsoft-com:vml"
xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns:m="http://schemas.microsoft.com/office/2004/12/omml"
xmlns="http://www.w3.org/TR/REC-html40">

<head>
<meta charset="UTF-8">
<meta name=ProgId content=Word.Document>
<meta name=Generator content="Microsoft Word 15">
<meta name=Originator content="Microsoft Word 15">
<title>${filename}_redacted</title>
<style>
@page WordSection1
{size:8.5in 11.0in;
margin:1.0in 1.0in 1.0in 1.0in;
mso-header-margin:.5in;
mso-footer-margin:.5in;
mso-paper-source:0;}
div.WordSection1
{page:WordSection1;}
body {
    font-family: "Times New Roman", serif;
    font-size: 12pt;
    line-height: 1.15;
    margin: 0;
}
p {
    margin: 0;
    margin-bottom: 8pt;
}
strong, b {
    font-weight: bold;
}
em, i {
    font-style: italic;
}
ul, ol {
    margin-left: 36pt;
}
.redacted-text {
    color: black;
    background-color: transparent;
}
</style>
</head>

<body lang=EN-US style='tab-interval:.5in'>
<div class=WordSection1>
${exportContent.innerHTML}
</div>
</body>
</html>`;

      const blob = new Blob([wordCompatibleHtml], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}_redacted.doc`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showStatus('Document downloaded successfully! The file can be opened in Microsoft Word.', 'success');
      
    } catch (error) {
      console.error('Download error:', error);
      showStatus('Error downloading document. Please try again.', 'error');
    }
  }, [filename, showStatus]);

  // Update document viewer when content changes
  useEffect(() => {
    if (documentViewerRef.current && currentContent) {
      documentViewerRef.current.innerHTML = currentContent;
    }
  }, [currentContent]);

  const styles = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      color: #333;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }

    .header {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      text-align: center;
    }

    .header h1 {
      font-size: 2.5rem;
      color: #4a5568;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .header p {
      color: #718096;
      font-size: 1.1rem;
    }

    .main-content {
      display: grid;
      grid-template-columns: 1fr 350px;
      gap: 30px;
      min-height: 600px;
    }

    .editor-panel {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .toolbar {
      background: linear-gradient(135deg, #4a5568, #2d3748);
      padding: 20px;
      border-bottom: 1px solid #e2e8f0;
    }

    .toolbar-row {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 15px;
    }

    .toolbar-row:last-child {
      margin-bottom: 0;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: left 0.5s;
    }

    .btn:hover::before {
      left: 100%;
    }

    .btn-primary {
      background: linear-gradient(135deg, #4299e1, #3182ce);
      color: white;
    }

    .btn-danger {
      background: linear-gradient(135deg, #f56565, #e53e3e);
      color: white;
    }

    .btn-success {
      background: linear-gradient(135deg, #48bb78, #38a169);
      color: white;
    }

    .btn-warning {
      background: linear-gradient(135deg, #ed8936, #dd6b20);
      color: white;
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .file-input {
      display: none;
    }

    .file-label {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 20px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s ease;
    }

    .file-label:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    }

    .document-viewer {
      padding: 40px;
      min-height: 500px;
      max-height: 600px;
      overflow-y: auto;
      background: white;
      line-height: 1.6;
      font-size: 14px;
    }

    .controls-panel {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 30px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      height: fit-content;
    }

    .controls-panel h3 {
      color: #4a5568;
      margin-bottom: 20px;
      font-size: 1.3rem;
    }

    .control-section {
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid #e2e8f0;
    }

    .control-section:last-child {
      border-bottom: none;
      margin-bottom: 0;
    }

    .control-section h4 {
      color: #718096;
      margin-bottom: 15px;
      font-size: 1rem;
    }

    .redacted-text {
      background: #000;
      color: #000;
      padding: 2px 4px;
      border-radius: 2px;
      user-select: none;
    }

    .suggestion-highlight {
      background: rgba(255, 193, 7, 0.3);
      padding: 2px 4px;
      border-radius: 2px;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .suggestion-highlight:hover {
      background: rgba(255, 193, 7, 0.5);
    }

    .suggestion-item {
      background: #f8f9fa;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 15px;
      margin-bottom: 10px;
      transition: all 0.3s ease;
    }

    .suggestion-item:hover {
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    }

    .suggestion-text {
      font-weight: 600;
      color: #4a5568;
      margin-bottom: 5px;
    }

    .suggestion-type {
      font-size: 12px;
      color: #718096;
      margin-bottom: 10px;
    }

    .suggestion-actions {
      display: flex;
      gap: 10px;
    }

    .btn-small {
      padding: 5px 12px;
      font-size: 12px;
    }

    .status-message {
      padding: 15px;
      border-radius: 10px;
      margin-bottom: 20px;
      font-weight: 500;
    }

    .status-success {
      background: #c6f6d5;
      color: #22543d;
      border: 1px solid #9ae6b4;
    }

    .status-info {
      background: #bee3f8;
      color: #2a4a6b;
      border: 1px solid #90cdf4;
    }

    .status-error {
      background: #fed7d7;
      color: #742a2a;
      border: 1px solid #feb2b2;
    }

    .upload-area {
      border: 2px dashed #cbd5e0;
      border-radius: 15px;
      padding: 40px;
      text-align: center;
      background: #f8f9fa;
      margin-bottom: 20px;
      transition: all 0.3s ease;
    }

    .upload-area:hover {
      border-color: #667eea;
      background: #f0f4ff;
    }

    .upload-icon {
      font-size: 3rem;
      color: #cbd5e0;
      margin-bottom: 15px;
    }

    @media (max-width: 768px) {
      .main-content {
        grid-template-columns: 1fr;
      }
      
      .toolbar-row {
        flex-wrap: wrap;
      }
    }

    .document-viewer::-webkit-scrollbar {
      width: 8px;
    }

    .document-viewer::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 10px;
    }

    .document-viewer::-webkit-scrollbar-thumb {
      background: linear-gradient(135deg, #667eea, #764ba2);
      border-radius: 10px;
    }

    .document-viewer::-webkit-scrollbar-thumb:hover {
      background: linear-gradient(135deg, #5a67d8, #6b46c1);
    }
  `;

  return (
    <>
      <style>{styles}</style>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"></script>
      
      <div className="container">
        <div className="header">
          <h1>Document Redaction Tool</h1>
          <p>Securely redact sensitive information from Word documents</p>
        </div>

        <div className="main-content">
          <div className="editor-panel">
            <div className="toolbar">
              {statusMessage && (
                <div className={`status-message status-${statusMessage.type}`}>
                  {statusMessage.text}
                </div>
              )}
              
              <div className="toolbar-row">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="file-input"
                  accept=".docx"
                  onChange={handleFileUpload}
                />
                <label htmlFor="docxFile" className="file-label" onClick={() => fileInputRef.current?.click()}>
                  📄 Upload DOCX File
                </label>
                <button
                  className="btn btn-danger"
                  disabled={!selectedText}
                  onClick={redactSelected}
                >
                  🖤 {selectedText ? `Redact "${selectedText.substring(0, 20)}${selectedText.length > 20 ? '...' : ''}"` : 'Redact Selected'}
                </button>
                <button
                  className="btn btn-warning"
                  disabled={!currentContent}
                  onClick={generateSuggestions}
                >
                  🤖 AI Suggestions
                </button>
              </div>
              <div className="toolbar-row">
                <button
                  className="btn btn-primary"
                  disabled={!currentContent}
                  onClick={downloadDocx}
                >
                  📥 Download DOCX
                </button>
                <button
                  className="btn"
                  disabled={redactionHistory.length === 0}
                  onClick={undoRedaction}
                  style={{ background: '#718096', color: 'white' }}
                >
                  ↶ Undo
                </button>
                <button
                  className="btn"
                  disabled={redactionCount === 0}
                  onClick={clearAllRedactions}
                  style={{ background: '#718096', color: 'white' }}
                >
                  🗑️ Clear All
                </button>
              </div>
            </div>
            
            <div
              className="document-viewer"
              ref={documentViewerRef}
              onMouseUp={handleTextSelection}
            >
              {!currentContent ? (
                <div className="upload-area">
                  <div className="upload-icon">📄</div>
                  <h3>Upload a Word Document</h3>
                  <p>Select a .docx file to begin redaction</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="controls-panel">
            <h3>Redaction Controls</h3>
            
            <div className="control-section">
              <h4>📊 Document Stats</h4>
              <div>
                <p><strong>Status:</strong> {currentContent ? 'Document loaded' : 'No document loaded'}</p>
                <p><strong>Redactions:</strong> {redactionCount}</p>
                <p><strong>File:</strong> {filename || 'None'}</p>
              </div>
            </div>

            <div className="control-section">
              <h4>🎯 AI Suggestions</h4>
              <div>
                {suggestions.length === 0 ? (
                  <p style={{ color: '#718096', fontStyle: 'italic' }}>
                    {currentContent ? 'No sensitive content detected.' : 'Load a document and click "AI Suggestions" to detect sensitive content automatically.'}
                  </p>
                ) : (
                  <>
                    <p style={{ marginBottom: '15px', color: '#4a5568' }}>
                      <strong>{suggestions.length}</strong> potential items found:
                    </p>
                    {suggestions.map((suggestion, index) => (
                      <div key={index} className="suggestion-item">
                        <div className="suggestion-text">"{suggestion.text}"</div>
                        <div className="suggestion-type">{suggestion.type}</div>
                        <div className="suggestion-actions">
                          <button
                            className="btn btn-danger btn-small"
                            onClick={() => acceptSuggestion(index)}
                          >
                            Redact
                          </button>
                          <button
                            className="btn btn-small"
                            onClick={() => rejectSuggestion(index)}
                            style={{ background: '#e2e8f0', color: '#4a5568' }}
                          >
                            Ignore
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="control-section">
              <h4>ℹ️ Instructions</h4>
              <ol style={{ color: '#718096', fontSize: '14px', lineHeight: '1.5' }}>
                <li>Upload a .docx file</li>
                <li>Select text to redact manually</li>
                <li>Use AI suggestions for automatic detection</li>
                <li>Download your redacted document</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DocumentRedactionTool;
