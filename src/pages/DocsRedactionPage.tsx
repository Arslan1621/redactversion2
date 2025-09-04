import React, { useState, useRef, useCallback, useEffect } from 'react';

// Declare mammoth as a global variable
declare global {
  interface Window {
    mammoth: any;
  }
}

interface Suggestion {
  text: string;
  type: string;
  index: number;
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
  const [mammothLoaded, setMammothLoaded] = useState<boolean>(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentViewerRef = useRef<HTMLDivElement>(null);

  // Load mammoth.js on component mount
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
    script.onload = () => {
      setMammothLoaded(true);
    };
    script.onerror = () => {
      console.error('Failed to load mammoth.js');
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const showStatus = useCallback((message: string, type: string) => {
    setStatusMessage({ text: message, type });
    setTimeout(() => setStatusMessage(null), 3000);
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!mammothLoaded || !window.mammoth) {
      showStatus('Please wait for the document processor to load...', 'info');
      return;
    }

    const newFilename = file.name.replace('.docx', '');
    setFilename(newFilename);
    
    try {
      showStatus('Loading document...', 'info');
      
      const arrayBuffer = await file.arrayBuffer();
      const result = await window.mammoth.convertToHtml({arrayBuffer: arrayBuffer});
      
      const content = result.value;
      setOriginalContent(content);
      setCurrentContent(content);
      setRedactionCount(0);
      setRedactionHistory([]);
      setSuggestions([]);
      setSelectedText('');
      
      showStatus('Document loaded successfully!', 'success');
    } catch (error) {
      console.error('Error loading document:', error);
      showStatus('Error loading document. Please try again.', 'error');
    }
  }, [mammothLoaded, showStatus]);

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
    
    try {
      const range = selection?.getRangeAt(0);
      if (range) {
        const redactedSpan = document.createElement('span');
        redactedSpan.className = 'redacted-text';
        redactedSpan.textContent = redactionBlocks;
        redactedSpan.setAttribute('data-original', selectedText);
        redactedSpan.style.background = '#000';
        redactedSpan.style.color = '#000';
        redactedSpan.style.padding = '2px 4px';
        redactedSpan.style.borderRadius = '2px';
        redactedSpan.style.userSelect = 'none';
        
        range.deleteContents();
        range.insertNode(redactedSpan);
        
        // Update current content
        setCurrentContent(documentViewerRef.current.innerHTML);
        selection?.removeAllRanges();
        setRedactionCount(prev => prev + 1);
        setSelectedText('');
      }
    } catch (error) {
      console.error('Error during redaction:', error);
      showStatus('Error during redaction. Please try again.', 'error');
    }
  }, [currentContent, showStatus]);

  const generateSuggestions = useCallback(() => {
    if (!documentViewerRef.current) return;
    
    const text = documentViewerRef.current.textContent || documentViewerRef.current.innerText || '';
    
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
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      while ((match = regex.exec(text)) !== null) {
        // Avoid infinite loop
        if (match.index === regex.lastIndex) {
          regex.lastIndex++;
        }
        newSuggestions.push({
          text: match[0],
          type: pattern.type,
          index: match.index
        });
      }
    });

    // Remove duplicates
    const uniqueSuggestions = newSuggestions.filter((suggestion, index, arr) => 
      arr.findIndex(s => s.text === suggestion.text && s.type === suggestion.type) === index
    );

    setSuggestions(uniqueSuggestions);
  }, []);

  const acceptSuggestion = useCallback((index: number) => {
    const suggestion = suggestions[index];
    if (!documentViewerRef.current || !suggestion) return;
    
    // Save current state for undo
    setRedactionHistory(prev => [...prev, currentContent]);
    
    try {
      // Find and replace the text
      const redactionBlocks = '█'.repeat(Math.max(1, Math.ceil(suggestion.text.length / 3)));
      const redactedSpan = `<span class="redacted-text" data-original="${suggestion.text}" style="background: #000; color: #000; padding: 2px 4px; border-radius: 2px; user-select: none;">${redactionBlocks}</span>`;
      
      const newContent = currentContent.replace(new RegExp(suggestion.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), redactedSpan);
      setCurrentContent(newContent);
      
      setRedactionCount(prev => prev + 1);
      setSuggestions(prev => prev.filter((_, i) => i !== index));
    } catch (error) {
      console.error('Error accepting suggestion:', error);
      showStatus('Error applying suggestion. Please try again.', 'error');
    }
  }, [suggestions, currentContent, showStatus]);

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
      if (!documentViewerRef.current || !currentContent) {
        showStatus('No document to download', 'error');
        return;
      }
      
      // Create a clean copy of the content for export
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = currentContent;
      
      // Process redacted elements
      const redactedElements = tempDiv.querySelectorAll('.redacted-text');
      redactedElements.forEach(el => {
        const original = el.getAttribute('data-original') || '';
        const blocks = '█'.repeat(Math.max(3, Math.ceil(original.length / 3)));
        el.textContent = blocks;
        (el as HTMLElement).style.backgroundColor = 'transparent';
        (el as HTMLElement).style.color = 'black';
      });
      
      // Create Word-compatible HTML
      const wordCompatibleHtml = `<!DOCTYPE html>
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
@page WordSection1 {
  size:8.5in 11.0in;
  margin:1.0in 1.0in 1.0in 1.0in;
  mso-header-margin:.5in;
  mso-footer-margin:.5in;
  mso-paper-source:0;
}
div.WordSection1 { page:WordSection1; }
body {
  font-family: "Times New Roman", serif;
  font-size: 12pt;
  line-height: 1.15;
  margin: 0;
}
p { margin: 0; margin-bottom: 8pt; }
strong, b { font-weight: bold; }
em, i { font-style: italic; }
ul, ol { margin-left: 36pt; }
.redacted-text {
  color: black;
  background-color: transparent;
}
</style>
</head>
<body lang=EN-US style='tab-interval:.5in'>
<div class=WordSection1>
${tempDiv.innerHTML}
</div>
</body>
</html>`;

      const blob = new Blob([wordCompatibleHtml], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename || 'document'}_redacted.doc`;
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
  }, [filename, currentContent, showStatus]);

  // Update document viewer when content changes
  useEffect(() => {
    if (documentViewerRef.current) {
      if (currentContent) {
        documentViewerRef.current.innerHTML = currentContent;
      } else {
        documentViewerRef.current.innerHTML = `
          <div style="border: 2px dashed #cbd5e0; border-radius: 15px; padding: 40px; text-align: center; background: #f8f9fa; transition: all 0.3s ease;">
            <div style="font-size: 3rem; color: #cbd5e0; margin-bottom: 15px;">📄</div>
            <h3>Upload a Word Document</h3>
            <p>Select a .docx file to begin redaction</p>
          </div>
        `;
      }
    }
  }, [currentContent]);

  return (
    <div style={{ 
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      minHeight: "100vh",
      color: "#333",
      margin: 0,
      padding: 0
    }}>
      <div style={{
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "20px"
      }}>
        {/* Header */}
        <div style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(10px)",
          borderRadius: "20px",
          padding: "30px",
          marginBottom: "30px",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)",
          textAlign: "center"
        }}>
          <h1 style={{
            fontSize: "2.5rem",
            color: "#4a5568",
            marginBottom: "10px",
            background: "linear-gradient(135deg, #667eea, #764ba2)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text"
          }}>Document Redaction Tool</h1>
          <p style={{
            color: "#718096",
            fontSize: "1.1rem",
            margin: 0
          }}>Securely redact sensitive information from Word documents</p>
        </div>

        {/* Main Content */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 350px",
          gap: "30px",
          minHeight: "600px"
        }}>
          {/* Editor Panel */}
          <div style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(10px)",
            borderRadius: "20px",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)",
            overflow: "hidden"
          }}>
            {/* Toolbar */}
            <div style={{
              background: "linear-gradient(135deg, #4a5568, #2d3748)",
              padding: "20px",
              borderBottom: "1px solid #e2e8f0"
            }}>
              {/* Status Message */}
              {statusMessage && (
                <div style={{
                  padding: "15px",
                  borderRadius: "10px",
                  marginBottom: "20px",
                  fontWeight: "500",
                  ...(statusMessage.type === 'success' && {
                    background: "#c6f6d5",
                    color: "#22543d",
                    border: "1px solid #9ae6b4"
                  }),
                  ...(statusMessage.type === 'info' && {
                    background: "#bee3f8",
                    color: "#2a4a6b",
                    border: "1px solid #90cdf4"
                  }),
                  ...(statusMessage.type === 'error' && {
                    background: "#fed7d7",
                    color: "#742a2a",
                    border: "1px solid #feb2b2"
                  })
                }}>
                  {statusMessage.text}
                </div>
              )}
              
              {/* First Toolbar Row */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "15px",
                marginBottom: "15px",
                flexWrap: "wrap"
              }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".docx"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!mammothLoaded}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 20px",
                    background: "linear-gradient(135deg, #667eea, #764ba2)",
                    color: "white",
                    borderRadius: "10px",
                    border: "none",
                    cursor: mammothLoaded ? "pointer" : "not-allowed",
                    fontWeight: "600",
                    transition: "all 0.3s ease",
                    fontSize: "14px",
                    opacity: mammothLoaded ? 1 : 0.6
                  }}
                >
                  📄 {mammothLoaded ? 'Upload DOCX File' : 'Loading...'}
                </button>
                
                <button
                  disabled={!selectedText}
                  onClick={redactSelected}
                  style={{
                    padding: "10px 20px",
                    border: "none",
                    borderRadius: "10px",
                    cursor: selectedText ? "pointer" : "not-allowed",
                    fontWeight: "600",
                    fontSize: "14px",
                    background: "linear-gradient(135deg, #f56565, #e53e3e)",
                    color: "white",
                    opacity: selectedText ? 1 : 0.6,
                    transition: "all 0.3s ease"
                  }}
                >
                  🖤 {selectedText ? `Redact "${selectedText.substring(0, 20)}${selectedText.length > 20 ? '...' : ''}"` : 'Redact Selected'}
                </button>
                
                <button
                  disabled={!currentContent}
                  onClick={generateSuggestions}
                  style={{
                    padding: "10px 20px",
                    border: "none",
                    borderRadius: "10px",
                    cursor: currentContent ? "pointer" : "not-allowed",
                    fontWeight: "600",
                    fontSize: "14px",
                    background: "linear-gradient(135deg, #ed8936, #dd6b20)",
                    color: "white",
                    opacity: currentContent ? 1 : 0.6,
                    transition: "all 0.3s ease"
                  }}
                >
                  🤖 AI Suggestions
                </button>
              </div>
              
              {/* Second Toolbar Row */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "15px",
                flexWrap: "wrap"
              }}>
                <button
                  disabled={!currentContent}
                  onClick={downloadDocx}
                  style={{
                    padding: "10px 20px",
                    border: "none",
                    borderRadius: "10px",
                    cursor: currentContent ? "pointer" : "not-allowed",
                    fontWeight: "600",
                    fontSize: "14px",
                    background: "linear-gradient(135deg, #4299e1, #3182ce)",
                    color: "white",
                    opacity: currentContent ? 1 : 0.6,
                    transition: "all 0.3s ease"
                  }}
                >
                  📥 Download DOCX
                </button>
                
                <button
                  disabled={redactionHistory.length === 0}
                  onClick={undoRedaction}
                  style={{
                    padding: "10px 20px",
                    border: "none",
                    borderRadius: "10px",
                    cursor: redactionHistory.length > 0 ? "pointer" : "not-allowed",
                    fontWeight: "600",
                    fontSize: "14px",
                    background: "#718096",
                    color: "white",
                    opacity: redactionHistory.length > 0 ? 1 : 0.6,
                    transition: "all 0.3s ease"
                  }}
                >
                  ↶ Undo
                </button>
                
                <button
                  disabled={redactionCount === 0}
                  onClick={clearAllRedactions}
                  style={{
                    padding: "10px 20px",
                    border: "none",
                    borderRadius: "10px",
                    cursor: redactionCount > 0 ? "pointer" : "not-allowed",
                    fontWeight: "600",
                    fontSize: "14px",
                    background: "#718096",
                    color: "white",
                    opacity: redactionCount > 0 ? 1 : 0.6,
                    transition: "all 0.3s ease"
                  }}
                >
                  🗑️ Clear All
                </button>
              </div>
            </div>
            
            {/* Document Viewer */}
            <div
              ref={documentViewerRef}
              onMouseUp={handleTextSelection}
              style={{
                padding: "40px",
                minHeight: "500px",
                maxHeight: "600px",
                overflowY: "auto",
                background: "white",
                lineHeight: "1.6",
                fontSize: "14px",
                cursor: "text"
              }}
            />
          </div>

          {/* Controls Panel */}
          <div style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(10px)",
            borderRadius: "20px",
            padding: "30px",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)",
            height: "fit-content"
          }}>
            <h3 style={{
              color: "#4a5568",
              marginBottom: "20px",
              fontSize: "1.3rem"
            }}>Redaction Controls</h3>
            
            {/* Document Stats */}
            <div style={{
              marginBottom: "30px",
              paddingBottom: "20px",
              borderBottom: "1px solid #e2e8f0"
            }}>
              <h4 style={{
                color: "#718096",
                marginBottom: "15px",
                fontSize: "1rem"
              }}>📊 Document Stats</h4>
              <div>
                <p style={{ margin: "5px 0" }}><strong>Status:</strong> {currentContent ? 'Document loaded' : 'No document loaded'}</p>
                <p style={{ margin: "5px 0" }}><strong>Redactions:</strong> {redactionCount}</p>
                <p style={{ margin: "5px 0" }}><strong>File:</strong> {filename || 'None'}</p>
              </div>
            </div>

            {/* AI Suggestions */}
            <div style={{
              marginBottom: "30px",
              paddingBottom: "20px",
              borderBottom: "1px solid #e2e8f0"
            }}>
              <h4 style={{
                color: "#718096",
                marginBottom: "15px",
                fontSize: "1rem"
              }}>🎯 AI Suggestions</h4>
              <div>
                {suggestions.length === 0 ? (
                  <p style={{ 
                    color: '#718096', 
                    fontStyle: 'italic',
                    margin: 0
                  }}>
                    {currentContent ? 'No sensitive content detected.' : 'Load a document and click "AI Suggestions" to detect sensitive content automatically.'}
                  </p>
                ) : (
                  <>
                    <p style={{ 
                      marginBottom: '15px', 
                      color: '#4a5568',
                      margin: "0 0 15px 0"
                    }}>
                      <strong>{suggestions.length}</strong> potential items found:
                    </p>
                    {suggestions.map((suggestion, index) => (
                      <div key={index} style={{
                        background: "#f8f9fa",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        padding: "15px",
                        marginBottom: "10px",
                        transition: "all 0.3s ease"
                      }}>
                        <div style={{
                          fontWeight: "600",
                          color: "#4a5568",
                          marginBottom: "5px"
                        }}>"{suggestion.text}"</div>
                        <div style={{
                          fontSize: "12px",
                          color: "#718096",
                          marginBottom: "10px"
                        }}>{suggestion.type}</div>
                        <div style={{
                          display: "flex",
                          gap: "10px"
                        }}>
                          <button
                            onClick={() => acceptSuggestion(index)}
                            style={{
                              padding: "5px 12px",
                              fontSize: "12px",
                              border: "none",
                              borderRadius: "5px",
                              cursor: "pointer",
                              fontWeight: "600",
                              background: "linear-gradient(135deg, #f56565, #e53e3e)",
                              color: "white",
                              transition: "all 0.3s ease"
                            }}
                          >
                            Redact
                          </button>
                          <button
                            onClick={() => rejectSuggestion(index)}
                            style={{
                              padding: "5px 12px",
                              fontSize: "12px",
                              border: "none",
                              borderRadius: "5px",
                              cursor: "pointer",
                              fontWeight: "600",
                              background: "#e2e8f0",
                              color: "#4a5568",
                              transition: "all 0.3s ease"
                            }}
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

            {/* Instructions */}
            <div>
              <h4 style={{
                color: "#718096",
                marginBottom: "15px",
                fontSize: "1rem"
              }}>ℹ️ Instructions</h4>
              <ol style={{ 
                color: '#718096', 
                fontSize: '14px', 
                lineHeight: '1.5',
                paddingLeft: "20px",
                margin: 0
              }}>
                <li>Upload a .docx file</li>
                <li>Select text to redact manually</li>
                <li>Use AI suggestions for automatic detection</li>
                <li>Download your redacted document</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentRedactionTool;
