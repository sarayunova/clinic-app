import { useState, useEffect, useCallback, type ChangeEvent, type FormEvent } from 'react';
import {
  api,
  type UltrasoundReport,
  type UltrasoundImage,
  type BiometricTag,
} from '../api';
import { ErrorBanner, Field } from './ui';

interface Props {
  report: UltrasoundReport;
  canEdit: boolean;
  onImagesUpdated: () => void;
}

export const BIOMETRIC_TAG_CONFIG: Record<
  BiometricTag,
  { label: string; color: string; bg: string }
> = {
  bpd: { label: 'BPD (Biparietal)', color: '#0284c7', bg: '#e0f2fe' },
  hc: { label: 'HC (Head Circum.)', color: '#0369a1', bg: '#e0f2fe' },
  ac: { label: 'AC (Abdominal)', color: '#0d9488', bg: '#ccfbf1' },
  fl: { label: 'FL (Femur Length)', color: '#16a34a', bg: '#dcfce7' },
  crl: { label: 'CRL (Crown-Rump)', color: '#2563eb', bg: '#dbeafe' },
  nt: { label: 'NT (Nuchal)', color: '#ea580c', bg: '#ffedd5' },
  cardiac: { label: 'Cardiac 4-Chamber', color: '#dc2626', bg: '#fee2e2' },
  doppler: { label: 'Doppler Velocimetry', color: '#7c3aed', bg: '#ede9fe' },
  placenta: { label: 'Placenta / Cord', color: '#d97706', bg: '#fef3c7' },
  '3d_face': { label: '3D Fetal Surface', color: '#db2777', bg: '#fce7f3' },
  general: { label: 'General Scan', color: '#475569', bg: '#f1f5f9' },
};

export function UltrasoundGallery({ report, canEdit, onImagesUpdated }: Props) {
  const images = report.images ?? [];

  // Uploader state
  const [showUpload, setShowUpload] = useState(false);
  const [fileData, setFileData] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [biometricTag, setBiometricTag] = useState<BiometricTag>('general');
  const [imageLabel, setImageLabel] = useState<string>('');
  const [measurementValue, setMeasurementValue] = useState<string>('');
  const [includeInPrint, setIncludeInPrint] = useState<boolean>(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<unknown>(null);

  // Edit modal state
  const [editingImage, setEditingImage] = useState<UltrasoundImage | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editTag, setEditTag] = useState<BiometricTag>('general');
  const [editMeasurement, setEditMeasurement] = useState('');
  const [editPrint, setEditPrint] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<unknown>(null);

  // Lightbox state
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [invert, setInvert] = useState<boolean>(false);
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [showHud, setShowHud] = useState<boolean>(true);

  const resetLightboxView = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setInvert(false);
    setBrightness(100);
    setContrast(100);
  }, []);

  const openLightbox = (idx: number) => {
    resetLightboxView();
    setActiveIdx(idx);
  };

  const closeLightbox = () => {
    setActiveIdx(null);
  };

  const handleNextImage = useCallback(() => {
    if (activeIdx == null || images.length === 0) return;
    setActiveIdx((activeIdx + 1) % images.length);
  }, [activeIdx, images.length]);

  const handlePrevImage = useCallback(() => {
    if (activeIdx == null || images.length === 0) return;
    setActiveIdx((activeIdx - 1 + images.length) % images.length);
  }, [activeIdx, images.length]);

  // Keyboard navigation inside lightbox
  useEffect(() => {
    if (activeIdx == null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowRight') handleNextImage();
      else if (e.key === 'ArrowLeft') handlePrevImage();
      else if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)));
      else if (e.key === '-' || e.key === '_') setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)));
      else if (e.key.toLowerCase() === 'r') setRotation((r) => (r + 90) % 360);
      else if (e.key.toLowerCase() === 'i') setInvert((inv) => !inv);
      else if (e.key.toLowerCase() === 'h') setShowHud((h) => !h);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIdx, handleNextImage, handlePrevImage]);

  // File picker handler
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    // Suggest default label from file name
    const clean = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    if (!imageLabel) setImageLabel(clean);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setFileData(result);
    };
    reader.readAsDataURL(file);
  };

  // Submit new image
  const handleUploadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fileData) {
      setUploadError(new Error('Please choose an ultrasound image or document file.'));
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      await api('POST', `/api/ultrasounds/${report.id}/images/upload`, {
        data: fileData,
        fileName: fileName || 'scan_image.jpg',
        biometricTag,
        imageLabel: imageLabel.trim() || null,
        measurementValue: measurementValue.trim() || null,
        includeInPrint,
      });

      // Clear form
      setFileData('');
      setFileName('');
      setImageLabel('');
      setMeasurementValue('');
      setBiometricTag('general');
      setShowUpload(false);
      onImagesUpdated();
    } catch (err) {
      setUploadError(err);
    } finally {
      setUploading(false);
    }
  };

  // Start edit image
  const startEditImage = (img: UltrasoundImage) => {
    setEditingImage(img);
    setEditLabel(img.imageLabel || '');
    setEditTag(img.biometricTag);
    setEditMeasurement(img.measurementValue || '');
    setEditPrint(img.includeInPrint);
    setEditError(null);
  };

  // Save edited image
  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingImage) return;

    try {
      setSavingEdit(true);
      setEditError(null);
      await api('PATCH', `/api/ultrasounds/${report.id}/images/${editingImage.id}`, {
        imageLabel: editLabel.trim() || null,
        biometricTag: editTag,
        measurementValue: editMeasurement.trim() || null,
        includeInPrint: editPrint,
      });
      setEditingImage(null);
      onImagesUpdated();
    } catch (err) {
      setEditError(err);
    } finally {
      setSavingEdit(false);
    }
  };

  // Toggle print inclusion shortcut
  const handleTogglePrint = async (img: UltrasoundImage) => {
    try {
      await api('PATCH', `/api/ultrasounds/${report.id}/images/${img.id}`, {
        includeInPrint: !img.includeInPrint,
      });
      onImagesUpdated();
    } catch {
      // non-blocking
    }
  };

  // Delete image
  const handleDeleteImage = async (imgId: number) => {
    if (!window.confirm('Delete this ultrasound image from the scan gallery?')) return;
    try {
      await api('DELETE', `/api/ultrasounds/${report.id}/images/${imgId}`);
      if (activeIdx !== null && images[activeIdx]?.id === imgId) {
        closeLightbox();
      }
      onImagesUpdated();
    } catch (err) {
      alert('Could not delete image: ' + String(err));
    }
  };

  const activeImage = activeIdx !== null ? images[activeIdx] : null;

  return (
    <div className="stack" style={{ gap: '0.6rem', marginTop: '0.5rem' }}>
      {/* Gallery Header Bar */}
      <div
        className="row wrap"
        style={{
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc',
          padding: '0.4rem 0.6rem',
          borderRadius: '4px',
          border: '1px solid var(--border)',
        }}
      >
        <div className="row wrap" style={{ gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
            🖼️ Scan Gallery ({images.length} {images.length === 1 ? 'image' : 'images'})
          </span>
          {images.length > 0 && (
            <span className="muted small" style={{ fontSize: '0.78rem' }}>
              · {images.filter((i) => i.includeInPrint).length} included in formal printout
            </span>
          )}
        </div>

        {canEdit && (
          <button
            type="button"
            className="btn small"
            style={{ fontSize: '0.8rem' }}
            onClick={() => setShowUpload((prev) => !prev)}
          >
            {showUpload ? '✕ Close Uploader' : '+ Upload Scan Image'}
          </button>
        )}
      </div>

      {/* Upload Panel */}
      {showUpload && canEdit && (
        <form
          onSubmit={handleUploadSubmit}
          className="stack"
          style={{
            background: '#f1f5f9',
            border: '1.5px dashed #0284c7',
            padding: '0.8rem',
            borderRadius: '6px',
            gap: '0.6rem',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0369a1' }}>
            Upload Sonographic Scan Image / Capture
          </div>

          {uploadError ? <ErrorBanner error={uploadError} /> : null}

          <div className="row wrap" style={{ gap: '0.8rem', alignItems: 'flex-start' }}>
            <Field label="Choose Scan File (JPEG / PNG / PDF) *">
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg,application/pdf"
                onChange={handleFileChange}
                required
              />
            </Field>

            <Field label="Biometric Tag">
              <select
                value={biometricTag}
                onChange={(e) => setBiometricTag(e.target.value as BiometricTag)}
              >
                {Object.entries(BIOMETRIC_TAG_CONFIG).map(([tag, conf]) => (
                  <option key={tag} value={tag}>
                    {conf.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Image Caption / Anatomical Plane">
              <input
                value={imageLabel}
                placeholder="e.g. BPD / HC Transthalamic Axial View"
                onChange={(e) => setImageLabel(e.target.value)}
                style={{ minWidth: '220px' }}
              />
            </Field>

            <Field label="Measurement Note">
              <input
                value={measurementValue}
                placeholder="e.g. BPD = 48.2 mm (20w4d)"
                onChange={(e) => setMeasurementValue(e.target.value)}
                style={{ minWidth: '180px' }}
              />
            </Field>
          </div>

          <div className="row wrap" style={{ gap: '0.8rem', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={includeInPrint}
                onChange={(e) => setIncludeInPrint(e.target.checked)}
              />
              <strong>Include in printed formal scan report</strong>
            </label>

            <div className="row" style={{ gap: '0.4rem', marginLeft: 'auto' }}>
              <button className="btn small primary" disabled={uploading}>
                {uploading ? 'Uploading…' : 'Save & Attach to Scan'}
              </button>
              <button
                type="button"
                className="btn small"
                onClick={() => setShowUpload(false)}
                disabled={uploading}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Images Grid */}
      {images.length === 0 ? (
        <div
          style={{
            padding: '1rem',
            textAlign: 'center',
            background: 'var(--bg)',
            borderRadius: '4px',
            border: '1px dashed var(--border)',
          }}
        >
          <span className="muted small">
            No sonography images attached yet. Click <strong>+ Upload Scan Image</strong> above to attach multi-plane ultrasound captures.
          </span>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {images.map((img, idx) => {
            const conf = BIOMETRIC_TAG_CONFIG[img.biometricTag] || BIOMETRIC_TAG_CONFIG.general;
            return (
              <div
                key={img.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  background: 'var(--card-bg, #ffffff)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                {/* Thumbnail Preview with click to lightbox */}
                <div
                  style={{
                    position: 'relative',
                    height: '130px',
                    background: '#090d16',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                  onClick={() => openLightbox(idx)}
                  title="Click to open interactive lightbox viewer"
                >
                  {img.mime === 'application/pdf' ? (
                    <div style={{ color: '#fff', textAlign: 'center', padding: '0.5rem' }}>
                      <span style={{ fontSize: '2rem' }}>📄</span>
                      <div style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>PDF Document</div>
                    </div>
                  ) : (
                    <img
                      src={`/api/attachments/${img.attachmentId}/file`}
                      alt={img.imageLabel || 'Ultrasound capture'}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'transform 0.2s ease',
                      }}
                      loading="lazy"
                    />
                  )}

                  {/* Biometric Tag Overlay Badge */}
                  <span
                    style={{
                      position: 'absolute',
                      top: '6px',
                      left: '6px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '3px',
                      backgroundColor: conf.bg,
                      color: conf.color,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                    }}
                  >
                    {conf.label}
                  </span>

                  {/* Print status badge */}
                  <span
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      fontSize: '0.68rem',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      backgroundColor: img.includeInPrint ? '#15803d' : '#475569',
                      color: '#ffffff',
                    }}
                    title={img.includeInPrint ? 'Included in printable scan report' : 'Omitted from printout'}
                  >
                    {img.includeInPrint ? '🖨️ Print' : 'Screen only'}
                  </span>
                </div>

                {/* Metadata Info Footer */}
                <div
                  style={{
                    padding: '0.45rem 0.6rem',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.3rem',
                    fontSize: '0.8rem',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={img.imageLabel || 'Untitled image'}
                    >
                      {img.imageLabel || 'Ultrasound Frame'}
                    </div>

                    {img.measurementValue && (
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#0284c7',
                          fontWeight: 500,
                          marginTop: '0.1rem',
                        }}
                      >
                        📏 {img.measurementValue}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div
                    className="row"
                    style={{
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid #e2e8f0',
                      paddingTop: '0.3rem',
                      marginTop: '0.2rem',
                    }}
                  >
                    <button
                      type="button"
                      className="btn small"
                      style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                      onClick={() => openLightbox(idx)}
                      title="Enlarge in lightbox viewer"
                    >
                      🔍 View
                    </button>

                    {canEdit && (
                      <div className="row" style={{ gap: '0.3rem' }}>
                        <button
                          type="button"
                          className="btn small"
                          style={{ padding: '2px 5px', fontSize: '0.72rem' }}
                          onClick={() => handleTogglePrint(img)}
                          title={img.includeInPrint ? 'Remove from print' : 'Include in print'}
                        >
                          {img.includeInPrint ? '🖨️ On' : 'Off'}
                        </button>
                        <button
                          type="button"
                          className="btn small"
                          style={{ padding: '2px 5px', fontSize: '0.72rem' }}
                          onClick={() => startEditImage(img)}
                          title="Edit image caption or tag"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="btn small muted"
                          style={{ padding: '2px 5px', fontSize: '0.72rem', color: '#dc2626' }}
                          onClick={() => void handleDeleteImage(img.id)}
                          title="Delete image"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Image Modal */}
      {editingImage && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <form
            onSubmit={handleSaveEdit}
            className="stack card"
            style={{
              maxWidth: '460px',
              width: '100%',
              background: '#fff',
              padding: '1.2rem',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              gap: '0.8rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>✏️ Edit Scan Image Details</h3>
            {editError ? <ErrorBanner error={editError} /> : null}

            <Field label="Biometric Tag">
              <select
                value={editTag}
                onChange={(e) => setEditTag(e.target.value as BiometricTag)}
              >
                {Object.entries(BIOMETRIC_TAG_CONFIG).map(([tag, conf]) => (
                  <option key={tag} value={tag}>
                    {conf.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Image Caption / Plane">
              <input
                value={editLabel}
                placeholder="e.g. Femur Diaphysis Measurement"
                onChange={(e) => setEditLabel(e.target.value)}
              />
            </Field>

            <Field label="Measurement Note">
              <input
                value={editMeasurement}
                placeholder="e.g. FL = 53.4 mm (28w1d)"
                onChange={(e) => setEditMeasurement(e.target.value)}
              />
            </Field>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={editPrint}
                onChange={(e) => setEditPrint(e.target.checked)}
              />
              <strong>Include in printed formal scan report</strong>
            </label>

            <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn small" onClick={() => setEditingImage(null)}>
                Cancel
              </button>
              <button className="btn small primary" disabled={savingEdit}>
                {savingEdit ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Interactive Lightbox Viewer Modal */}
      {activeImage && activeIdx !== null && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(10, 15, 26, 0.96)',
            zIndex: 1100,
            display: 'flex',
            flexDirection: 'column',
            userSelect: 'none',
          }}
        >
          {/* Top Control Bar */}
          <div
            style={{
              padding: '0.6rem 1rem',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.8rem',
              background: '#0f172a',
              borderBottom: '1px solid #1e293b',
              color: '#f8fafc',
            }}
          >
            {/* Title & Tag */}
            <div className="row" style={{ gap: '0.6rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Image {activeIdx + 1} of {images.length}
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '3px',
                  backgroundColor: BIOMETRIC_TAG_CONFIG[activeImage.biometricTag]?.bg || '#334155',
                  color: BIOMETRIC_TAG_CONFIG[activeImage.biometricTag]?.color || '#fff',
                }}
              >
                {BIOMETRIC_TAG_CONFIG[activeImage.biometricTag]?.label || activeImage.biometricTag}
              </span>
              <strong style={{ fontSize: '0.95rem' }}>
                {activeImage.imageLabel || activeImage.originalName}
              </strong>
            </div>

            {/* Viewer Controls */}
            <div className="row wrap" style={{ gap: '0.4rem', alignItems: 'center' }}>
              {/* Zoom Buttons */}
              <div className="row" style={{ gap: '2px', background: '#1e293b', borderRadius: '4px', padding: '2px' }}>
                <button
                  type="button"
                  className="btn small"
                  style={{ background: 'transparent', color: '#fff', border: 'none', padding: '3px 8px' }}
                  onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                  title="Zoom Out (-)"
                >
                  🔍-
                </button>
                <span style={{ fontSize: '0.75rem', color: '#cbd5e1', padding: '0 4px', lineHeight: '24px' }}>
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  className="btn small"
                  style={{ background: 'transparent', color: '#fff', border: 'none', padding: '3px 8px' }}
                  onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                  title="Zoom In (+)"
                >
                  🔍+
                </button>
              </div>

              {/* Rotate */}
              <button
                type="button"
                className="btn small"
                style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155' }}
                onClick={() => setRotation((r) => (r + 90) % 360)}
                title="Rotate 90° Clockwise (R)"
              >
                ↻ {rotation}°
              </button>

              {/* Invert Filter */}
              <button
                type="button"
                className="btn small"
                style={{
                  background: invert ? '#0284c7' : '#1e293b',
                  color: '#fff',
                  border: '1px solid #334155',
                }}
                onClick={() => setInvert((inv) => !inv)}
                title="Toggle Inverted Color Filter / Sonography Dark-Room Mode (I)"
              >
                🌓 Invert
              </button>

              {/* Brightness & Contrast Popover Sliders */}
              <div className="row" style={{ gap: '0.4rem', alignItems: 'center', background: '#1e293b', padding: '2px 8px', borderRadius: '4px' }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>☀️</span>
                <input
                  type="range"
                  min="50"
                  max="180"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  style={{ width: '60px' }}
                  title={`Brightness: ${brightness}%`}
                />
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: '4px' }}>◑</span>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  style={{ width: '60px' }}
                  title={`Contrast: ${contrast}%`}
                />
              </div>

              {/* HUD Toggle */}
              <button
                type="button"
                className="btn small"
                style={{
                  background: showHud ? '#0f766e' : '#1e293b',
                  color: '#fff',
                  border: '1px solid #334155',
                }}
                onClick={() => setShowHud((h) => !h)}
                title="Toggle Biometric HUD Overlay (H)"
              >
                📊 HUD {showHud ? 'ON' : 'OFF'}
              </button>

              {/* Reset */}
              <button
                type="button"
                className="btn small"
                style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}
                onClick={resetLightboxView}
                title="Reset Zoom, Rotation and Filters"
              >
                Reset
              </button>

              {/* Close Button */}
              <button
                type="button"
                className="btn small"
                style={{ background: '#dc2626', color: '#fff', border: 'none', marginLeft: '0.4rem' }}
                onClick={closeLightbox}
                title="Close Lightbox (Esc)"
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Viewport Area */}
          <div
            style={{
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#050811',
            }}
          >
            {/* Previous Image Button */}
            {images.length > 1 && (
              <button
                type="button"
                onClick={handlePrevImage}
                style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(15, 23, 42, 0.75)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '50%',
                  width: '44px',
                  height: '44px',
                  fontSize: '1.4rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 20,
                  transition: 'background 0.2s',
                }}
                title="Previous Image (Left Arrow)"
              >
                ‹
              </button>
            )}

            {/* Next Image Button */}
            {images.length > 1 && (
              <button
                type="button"
                onClick={handleNextImage}
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(15, 23, 42, 0.75)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '50%',
                  width: '44px',
                  height: '44px',
                  fontSize: '1.4rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 20,
                  transition: 'background 0.2s',
                }}
                title="Next Image (Right Arrow)"
              >
                ›
              </button>
            )}

            {/* Displayed Image */}
            {activeImage.mime === 'application/pdf' ? (
              <div style={{ color: '#fff', textAlign: 'center', padding: '2rem' }}>
                <span style={{ fontSize: '4rem' }}>📄</span>
                <p style={{ marginTop: '0.8rem', fontSize: '1rem' }}>PDF Sonography Document Attachment</p>
                <a
                  href={`/api/attachments/${activeImage.attachmentId}/file?download=1`}
                  className="btn primary"
                  download
                >
                  Download PDF File
                </a>
              </div>
            ) : (
              <img
                src={`/api/attachments/${activeImage.attachmentId}/file`}
                alt={activeImage.imageLabel || 'Ultrasound view'}
                style={{
                  maxWidth: '90%',
                  maxHeight: '85%',
                  objectFit: 'contain',
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  filter: `${invert ? 'invert(1) hue-rotate(180deg)' : ''} brightness(${brightness}%) contrast(${contrast}%)`,
                  transition: 'transform 0.15s ease-out, filter 0.15s ease-out',
                  boxShadow: '0 4px 30px rgba(0,0,0,0.8)',
                  cursor: zoom > 1 ? 'grab' : 'default',
                }}
              />
            )}

            {/* Heads-Up Display (HUD) Overlay */}
            {showHud && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '20px',
                  left: '20px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(8px)',
                  color: '#f8fafc',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  borderRadius: '6px',
                  padding: '0.7rem 0.9rem',
                  maxWidth: '340px',
                  fontSize: '0.8rem',
                  lineHeight: 1.4,
                  zIndex: 10,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#38bdf8', marginBottom: '0.3rem' }}>
                  📊 BIOMETRIC HUD OVERLAY
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.2rem 0.6rem' }}>
                  <span style={{ color: '#94a3b8' }}>Scan Date:</span>
                  <span>{report.scanDate}</span>

                  <span style={{ color: '#94a3b8' }}>Target:</span>
                  <span style={{ fontWeight: 600, color: '#f1f5f9' }}>
                    {BIOMETRIC_TAG_CONFIG[activeImage.biometricTag]?.label || activeImage.biometricTag}
                  </span>

                  {activeImage.measurementValue && (
                    <>
                      <span style={{ color: '#94a3b8' }}>Measure:</span>
                      <span style={{ color: '#38bdf8', fontWeight: 600 }}>{activeImage.measurementValue}</span>
                    </>
                  )}

                  {report.gestationalAgeWeeks != null && (
                    <>
                      <span style={{ color: '#94a3b8' }}>GA:</span>
                      <span>{report.gestationalAgeWeeks}w {report.gestationalAgeDays ?? 0}d</span>
                    </>
                  )}

                  {report.efwGrams != null && (
                    <>
                      <span style={{ color: '#94a3b8' }}>EFW:</span>
                      <span>{report.efwGrams} g ({report.efwPercentile ? report.efwPercentile.split(' ')[0] : 'Hadlock'})</span>
                    </>
                  )}

                  {report.amnioticFluidCm != null && (
                    <>
                      <span style={{ color: '#94a3b8' }}>AFI / Fluid:</span>
                      <span>{report.amnioticFluidCm} cm ({report.amnioticFluidAssessment || 'Normal'})</span>
                    </>
                  )}

                  {report.fhrBpm != null && (
                    <>
                      <span style={{ color: '#94a3b8' }}>FHR:</span>
                      <span>{report.fhrBpm} bpm</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Information Bar */}
          <div
            style={{
              padding: '0.5rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#0f172a',
              borderTop: '1px solid #1e293b',
              color: '#94a3b8',
              fontSize: '0.8rem',
            }}
          >
            <div>
              {activeImage.measurementValue ? (
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                  📏 Measurement: {activeImage.measurementValue}
                </span>
              ) : (
                <span>Frame: {activeImage.originalName}</span>
              )}
              <span style={{ marginLeft: '0.8rem', fontSize: '0.75rem' }}>
                ({Math.round(activeImage.sizeBytes / 1024)} KB)
              </span>
            </div>

            <div className="row" style={{ gap: '0.8rem', alignItems: 'center' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  color: activeImage.includeInPrint ? '#4ade80' : '#94a3b8',
                }}
              >
                <input
                  type="checkbox"
                  checked={activeImage.includeInPrint}
                  onChange={() => void handleTogglePrint(activeImage)}
                />
                🖨️ Include in printed report
              </label>

              <a
                href={`/api/attachments/${activeImage.attachmentId}/file?download=1`}
                className="btn small"
                style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', padding: '2px 8px' }}
                download
              >
                ⬇️ Download
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
