import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  X, 
  FileCode,
  Sparkles,
  FolderOpen
} from 'lucide-react';

export default function WorkspaceUpload({ onSelectFileForPrompt }) {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [previewContent, setPreviewContent] = useState(null);
  const [previewFilename, setPreviewFilename] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  
  const fileInputRef = useRef(null);

  const fetchFiles = async () => {
    try {
      const resp = await fetch('/api/workspace/files');
      if (resp.ok) {
        const data = await resp.json();
        setFiles(data.files || []);
      }
    } catch (e) {
      console.error('Failed to load workspace files', e);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const resp = await fetch('/api/workspace/upload', {
        method: 'POST',
        body: formData
      });

      const resData = await resp.json();
      if (resp.ok) {
        setUploadMessage({ type: 'success', text: `Uploaded "${resData.filename}" (${resData.size_kb} KB)` });
        await fetchFiles();
        // Clear input
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setUploadMessage({ type: 'error', text: resData.detail || 'Upload failed.' });
      }
    } catch (err) {
      setUploadMessage({ type: 'error', text: 'Network error uploading file.' });
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadMessage(null), 4000);
    }
  };

  const handleDeleteFile = async (filename, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${filename}" from workspace?`)) return;

    try {
      const resp = await fetch(`/api/workspace/files/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      if (resp.ok) {
        setFiles(prev => prev.filter(f => f.name !== filename));
        if (previewFilename === filename) {
          setPreviewContent(null);
          setPreviewFilename(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete file', err);
    }
  };

  const handlePreviewFile = async (filename, e) => {
    e.stopPropagation();
    try {
      setPreviewFilename(filename);
      setPreviewContent('Loading preview...');
      const resp = await fetch(`/api/workspace/files/${encodeURIComponent(filename)}/preview`);
      if (resp.ok) {
        const data = await resp.json();
        setPreviewContent(data.content || '(Empty file)');
      } else {
        setPreviewContent('Could not preview this file.');
      }
    } catch (err) {
      setPreviewContent('Error loading preview.');
    }
  };

  return (
    <div className="space-y-3">
      {/* Header bar / Toggle */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-cyan-400 transition-colors"
        >
          <FolderOpen className="w-4 h-4 text-cyan-400" />
          <span>Workspace Files ({files.length})</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
            {isOpen ? 'Collapse' : 'Manage Files'}
          </span>
        </button>

        <div className="flex items-center gap-2">
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.csv,.md,.json,.doc,.docx"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isUploading ? 'Uploading...' : 'Upload Document'}</span>
          </button>
        </div>
      </div>

      {/* Upload Toast Message */}
      {uploadMessage && (
        <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
          uploadMessage.type === 'success' 
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
        }`}>
          {uploadMessage.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          <span>{uploadMessage.text}</span>
        </div>
      )}

      {/* Files Drawer */}
      {isOpen && (
        <div className="p-3.5 rounded-xl glass-card border border-white/10 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Allowed formats: PDF, TXT, CSV, Markdown, JSON. Files are sandboxed in <code className="text-cyan-300 font-mono">workspace/</code>.</span>
            <button 
              type="button" 
              onClick={fetchFiles}
              className="hover:text-cyan-300 flex items-center gap-1 text-[11px]"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>

          {files.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-white/10 rounded-xl text-slate-500 text-xs">
              No files in workspace yet. Click "Upload Document" to add PDFs, resumes, or contracts.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {files.map((file) => (
                <div
                  key={file.name}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/5 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all text-xs group"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div className="truncate">
                      <p className="font-medium text-slate-200 truncate">{file.name}</p>
                      <p className="text-[10px] text-slate-400">{file.size_kb} KB • {file.modified}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      type="button"
                      title="Use in task prompt"
                      onClick={() => onSelectFileForPrompt?.(file.name)}
                      className="p-1 rounded hover:bg-cyan-500/20 text-cyan-300 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Preview file"
                      onClick={(e) => handlePreviewFile(file.name, e)}
                      className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Delete file"
                      onClick={(e) => handleDeleteFile(file.name, e)}
                      className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* File Preview Modal */}
      {previewFilename && (
        <div className="p-4 rounded-xl glass-card border border-cyan-500/30 bg-slate-900/90 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-white/10 text-xs">
            <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
              <FileCode className="w-4 h-4" />
              Preview: {previewFilename}
            </span>
            <button
              type="button"
              onClick={() => { setPreviewFilename(null); setPreviewContent(null); }}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <pre className="text-xs text-slate-300 font-mono max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed bg-black/40 p-3 rounded-lg border border-white/5">
            {previewContent}
          </pre>
        </div>
      )}
    </div>
  );
}
