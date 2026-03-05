import React, { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  UploadCloud,
  FileText,
  X,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Box,
  FileDigit,
  MapPin,
  Hexagon,
  Layers
} from 'lucide-react';
import BoundaryViewer from './BoundaryViewer';

function App() {
  const [activeTab, setActiveTab] = useState('generator'); // 'generator' | 'viewer'
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, processing, success, error
  const [message, setMessage] = useState('Waiting for files...');
  const fileInputRef = useRef(null);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles) => {
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (files.length === 1) {
      setStatus('idle');
      setMessage('Waiting for files...');
    }
  };

  const triggerBIMGeneration = async () => {
    if (files.length === 0) return;

    setStatus('processing');
    setMessage('Uploading files to local backend...');

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await axios.post('http://localhost:3001/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Upload success:', response.data);
      setMessage(`Server received ${files.length} files. Job ID: ${response.data.jobId}. Waiting for Revit processing...`);

      setTimeout(() => {
        setStatus('success');
        setMessage('BIM Model generated successfully! Check your local Revit instance.');
      }, 5000);

    } catch (error) {
      console.error('Upload failed:', error);
      setStatus('error');
      setMessage('Failed to upload files to backend server. Make sure it is running on port 3001.');
    }
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['csv'].includes(ext)) return <FileDigit size={18} />;
    if (['dgn', 'dwg'].includes(ext)) return <Hexagon size={18} />;
    if (['shp', 'geojson'].includes(ext)) return <MapPin size={18} />;
    return <FileText size={18} />;
  };

  return (
    <div className="app-container">
      <header>
        <div className="logo-section">
          <div className="logo-icon">
            <Box size={24} />
          </div>
          <h1>CEDD Slope Modeler</h1>
        </div>

        <div className="tab-navigation">
          <button
            className={`tab-btn ${activeTab === 'generator' ? 'active' : ''}`}
            onClick={() => setActiveTab('generator')}
          >
            <Box size={18} /> Revit Generator
          </button>
          <button
            className={`tab-btn ${activeTab === 'viewer' ? 'active' : ''}`}
            onClick={() => setActiveTab('viewer')}
          >
            <MapPin size={18} /> Boundary Viewer
          </button>
        </div>

        <div>
          <span className="file-badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6EE7B7' }}>Revit 2025</span>
        </div>
      </header>

      {activeTab === 'generator' ? (
        <main className="main-content">
          <section className="upload-section">
            <h2 className="section-title">
              Data Upload Zone
            </h2>

            <div
              className={`drop-zone ${isDragging ? 'active' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="drop-zone-icon" />
              <h3>Drag & Drop Files Here</h3>
              <p>Upload Civil 3D exports, LiDAR point clouds, or boundary definitions to automatically generate authoritative CEDD BIM models.</p>

              <div className="file-types">
                <span className="file-badge">.CSV</span>
                <span className="file-badge">.DGN / .DWG</span>
                <span className="file-badge">.PDF</span>
                <span className="file-badge">.LAS / .LAZ</span>
                <span className="file-badge">.SHP</span>
              </div>

              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileInput}
                style={{ display: 'none' }}
              />
            </div>

            {status === 'success' && (
              <div className="glass-panel" style={{ padding: '1.5rem', marginTop: '1rem' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Box size={20} className="file-icon" />
                  Generated Preview
                </h3>
                <div className="viewer-placeholder">
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <Hexagon size={48} style={{ opacity: 0.5, marginBottom: '1rem', animation: 'spin 10s linear infinite' }} />
                    <p>3D Web Viewer Integration Placeholder</p>
                  </div>
                </div>
              </div>
            )}
          </section>

          <aside>
            <div className="glass-panel status-panel">
              <h2 className="section-title" style={{ fontSize: '1.1rem' }}>
                Job Status
              </h2>

              <button
                className="action-btn"
                onClick={triggerBIMGeneration}
                disabled={files.length === 0 || status === 'processing'}
              >
                {status === 'processing' ? (
                  <><Loader2 size={20} className="spinner" /> Generating...</>
                ) : (
                  <><Play size={20} fill="currentColor" /> Generate BIM Model</>
                )}
              </button>

              <div className={`status-indicator ${status}`}>
                {status === 'idle' && <AlertCircle size={20} />}
                {status === 'processing' && <Loader2 size={20} className="spinner" />}
                {status === 'success' && <CheckCircle2 size={20} />}
                {status === 'error' && <AlertCircle size={20} />}
                <div>
                  <strong style={{ display: 'block', marginBottom: '4px' }}>
                    {status === 'idle' && 'Waiting'}
                    {status === 'processing' && 'Processing...'}
                    {status === 'success' && 'Operation Complete'}
                    {status === 'error' && 'Error Encountered'}
                  </strong>
                  {message}
                </div>
              </div>

              {files.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Queued Files ({files.length})
                  </h3>
                  <div className="file-list">
                    {files.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="file-item">
                        <div className="file-info">
                          {getFileIcon(file.name)}
                          <span className="file-name" title={file.name}>{file.name}</span>
                        </div>
                        {status !== 'processing' && (
                          <button className="remove-btn" onClick={() => removeFile(index)} title="Remove file">
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </main>
      ) : (
        <BoundaryViewer />
      )}
    </div>
  );
}

export default App;
