import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, type ClinicSettings } from '../api';
import { BackupPanel } from '../components/BackupPanel';
import { SecurityPanel } from '../components/SecurityPanel';
import { SignatureBlock } from '../components/SignatureBlock';
import { ErrorBanner, Field } from '../components/ui';

/**
 * Resizes an uploaded image file down to max dimensions using an offscreen canvas.
 * Preserves transparency and returns an optimized PNG data URL.
 */
function resizeImageToDataUrl(file: File, maxWidth: number, maxHeight: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function SettingsPage() {
  const [f, setF] = useState<ClinicSettings | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'doctor' | 'logo' | 'signature' | 'letterhead'>('details');

  // Canvas drawing state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState<'#0f4c81' | '#111827'>('#0f4c81');
  const [hasDrawnOnCanvas, setHasDrawnOnCanvas] = useState(false);

  useEffect(() => {
    api<ClinicSettings>('GET', '/api/settings').then(setF, setError);
  }, []);

  if (!f) return <p className="muted">{error ? '' : 'Loading clinic settings…'}<ErrorBanner error={error} /></p>;

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    setError(null);
    setBusy(true);
    try {
      await api('PUT', '/api/settings', f);
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  // --- Drawing Canvas Handlers ---
  function getCanvasCoords(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      if (!touch) return { x: 0, y: 0 };
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function startDrawing(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = penColor;
    setIsDrawing(true);
    setHasDrawnOnCanvas(true);
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function stopDrawing() {
    setIsDrawing(false);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnOnCanvas(false);
  }

  function applyDrawnSignature() {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawnOnCanvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setF({ ...f!, signatureDataUrl: dataUrl, showSignatureOnPrint: '1' });
  }

  // --- Image Upload Handlers ---
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const resized = await resizeImageToDataUrl(file, 450, 160);
      setF({ ...f!, logoDataUrl: resized, showLogoOnPrint: '1' });
    } catch (err) {
      setError('Could not process logo image. Please upload a valid PNG, JPG, or WebP file.');
    }
  }

  async function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const resized = await resizeImageToDataUrl(file, 400, 140);
      setF({ ...f!, signatureDataUrl: resized, showSignatureOnPrint: '1' });
    } catch (err) {
      setError('Could not process signature image. Please upload a valid PNG or JPG file.');
    }
  }

  return (
    <div className="page" style={{ maxWidth: '980px', margin: '0 auto' }}>
      <h1>Clinic Details &amp; Document Letterhead</h1>
      <p className="muted">
        Configure clinic branding, doctor credentials, letterhead layouts, and digital signature stamps across all printable prescriptions, ultrasound reports, lab orders, and discharge summaries.
      </p>

      <div className="row wrap" style={{ gap: '0.6rem', marginBottom: '1.25rem' }}>
        <Link className="btn small" to="/settings/checklist">Setup checklist: ready for real patients</Link>
        <Link className="btn small" to="/settings/prescription-templates">Prescription templates / regimens</Link>
      </div>

      <ErrorBanner error={error} />
      {saved && <div className="banner ok" role="status" style={{ marginBottom: '1rem' }}>Clinic details and document letterhead saved successfully.</div>}

      <form onSubmit={save} className="stack" style={{ gap: '1.25rem' }}>
        {/* Navigation Tabs */}
        <div className="row wrap" style={{ gap: '0.4rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
          <button
            type="button"
            className={`btn small ${activeTab === 'details' ? 'primary' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            🏛️ Clinic &amp; Contacts
          </button>
          <button
            type="button"
            className={`btn small ${activeTab === 'doctor' ? 'primary' : ''}`}
            onClick={() => setActiveTab('doctor')}
          >
            👨‍⚕️ Doctor Credentials
          </button>
          <button
            type="button"
            className={`btn small ${activeTab === 'logo' ? 'primary' : ''}`}
            onClick={() => setActiveTab('logo')}
          >
            🖼️ Clinic Logo
          </button>
          <button
            type="button"
            className={`btn small ${activeTab === 'signature' ? 'primary' : ''}`}
            onClick={() => setActiveTab('signature')}
          >
            ✍️ Signature &amp; Stamp
          </button>
          <button
            type="button"
            className={`btn small ${activeTab === 'letterhead' ? 'primary' : ''}`}
            onClick={() => setActiveTab('letterhead')}
          >
            📄 Letterhead &amp; Paper
          </button>
        </div>

        {/* Tab 1: Clinic Information */}
        {activeTab === 'details' && (
          <div className="card stack">
            <h2 style={{ fontSize: '1.15rem', margin: '0 0 0.5rem 0' }}>Clinic Profile &amp; Contact Details</h2>
            <Field label="Clinic / Hospital Name">
              <input
                value={f.clinicName || ''}
                onChange={(e) => setF({ ...f, clinicName: e.target.value })}
                placeholder="e.g. Dr. Rao's Maternity &amp; Surgical Hospital"
                maxLength={300}
                required
              />
            </Field>

            <Field label="Tagline / Specialty Description">
              <input
                value={f.clinicTagline || ''}
                onChange={(e) => setF({ ...f, clinicTagline: e.target.value })}
                placeholder="e.g. Centre for Advanced Obstetrics, Fetal Medicine &amp; Laparoscopic Surgery"
                maxLength={300}
              />
            </Field>

            <Field label="Clinic Postal Address (lines separated by Enter)">
              <textarea
                rows={3}
                value={f.address || ''}
                onChange={(e) => setF({ ...f, address: e.target.value })}
                placeholder="e.g. 42 Hospital Road, Near Clock Tower, District Hospital Junction&#10;Belagavi, Karnataka - 590001"
                maxLength={600}
              />
            </Field>

            <div className="row wrap" style={{ gap: '1rem' }}>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <Field label="Phone Number(s)">
                  <input
                    value={f.phone || ''}
                    onChange={(e) => setF({ ...f, phone: e.target.value })}
                    placeholder="e.g. +91 98765 43210 / 0831-248900"
                    maxLength={150}
                  />
                </Field>
              </div>

              <div style={{ flex: 1, minWidth: '220px' }}>
                <Field label="Clinic Email">
                  <input
                    type="email"
                    value={f.email || ''}
                    onChange={(e) => setF({ ...f, email: e.target.value })}
                    placeholder="e.g. care@drraoclinic.com"
                    maxLength={150}
                  />
                </Field>
              </div>

              <div style={{ flex: 1, minWidth: '220px' }}>
                <Field label="Clinic Website">
                  <input
                    value={f.website || ''}
                    onChange={(e) => setF({ ...f, website: e.target.value })}
                    placeholder="e.g. www.drraoclinic.com"
                    maxLength={150}
                  />
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Doctor Credentials */}
        {activeTab === 'doctor' && (
          <div className="card stack">
            <h2 style={{ fontSize: '1.15rem', margin: '0 0 0.5rem 0' }}>Consultant &amp; Physician Profile</h2>
            <Field label="Lead Doctor / Physician Full Name">
              <input
                value={f.doctorName || ''}
                onChange={(e) => setF({ ...f, doctorName: e.target.value })}
                placeholder="e.g. Dr. K. Sarayu Rao"
                maxLength={300}
              />
            </Field>

            <Field label="Medical Degrees &amp; Qualifications">
              <input
                value={f.doctorQualifications || ''}
                onChange={(e) => setF({ ...f, doctorQualifications: e.target.value })}
                placeholder="e.g. MBBS, MS (OBGYN), DNB, FMAS, Fellow in Fetal Medicine"
                maxLength={300}
              />
            </Field>

            <Field label="State Medical Council Registration Number">
              <input
                value={f.registrationNo || ''}
                onChange={(e) => setF({ ...f, registrationNo: e.target.value })}
                placeholder="e.g. KMC-54219 / MCI-2012-089"
                maxLength={150}
              />
            </Field>
          </div>
        )}

        {/* Tab 3: Clinic Logo */}
        {activeTab === 'logo' && (
          <div className="card stack">
            <h2 style={{ fontSize: '1.15rem', margin: '0 0 0.5rem 0' }}>Clinic Brand Logo</h2>
            <p className="muted small">
              Upload your hospital or clinic brand logo. Images are automatically optimized and embedded into printed documents. Transparent PNG or SVG recommended.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', margin: '0.5rem 0' }}>
              <div
                style={{
                  width: '200px',
                  height: '90px',
                  border: '1.5px dashed #cbd5e1',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f8fafc',
                  overflow: 'hidden',
                  padding: '0.4rem',
                }}
              >
                {f.logoDataUrl ? (
                  <img
                    src={f.logoDataUrl}
                    alt="Clinic Logo Preview"
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <span className="muted small">No logo uploaded</span>
                )}
              </div>

              <div className="stack" style={{ gap: '0.5rem' }}>
                <label className="btn small" style={{ cursor: 'pointer', display: 'inline-block' }}>
                  📁 Choose Logo Image
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    style={{ display: 'none' }}
                  />
                </label>

                {f.logoDataUrl && (
                  <button
                    type="button"
                    className="btn small danger"
                    onClick={() => setF({ ...f, logoDataUrl: '' })}
                  >
                    🗑️ Remove Logo
                  </button>
                )}
              </div>
            </div>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', marginTop: '0.5rem' }}>
              <input
                type="checkbox"
                checked={f.showLogoOnPrint !== '0'}
                onChange={(e) => setF({ ...f, showLogoOnPrint: e.target.checked ? '1' : '0' })}
              />
              <span style={{ fontSize: '0.9rem' }}>Show clinic logo on printed documents and letterheads</span>
            </label>
          </div>
        )}

        {/* Tab 4: Digital Signature & Seal Stamp */}
        {activeTab === 'signature' && (
          <div className="card stack">
            <h2 style={{ fontSize: '1.15rem', margin: '0 0 0.5rem 0' }}>Digital Signature &amp; Doctor Stamp</h2>
            <p className="muted small">
              Upload a scanned signature or draw it directly using your mouse, trackpad, or touchscreen stylus (Surface Pen / iPad).
            </p>

            {/* Drawing Canvas */}
            <div style={{ marginTop: '0.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: '0.9rem' }}>Draw Signature Live:</strong>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className="muted small">Pen Color:</span>
                  <button
                    type="button"
                    onClick={() => setPenColor('#0f4c81')}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: '#0f4c81',
                      border: penColor === '#0f4c81' ? '2px solid #000' : 'none',
                      cursor: 'pointer',
                    }}
                    title="Royal Blue"
                  />
                  <button
                    type="button"
                    onClick={() => setPenColor('#111827')}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: '#111827',
                      border: penColor === '#111827' ? '2px solid #3b82f6' : 'none',
                      cursor: 'pointer',
                    }}
                    title="Black"
                  />
                </div>
              </div>

              <canvas
                ref={canvasRef}
                width={420}
                height={130}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '4px',
                  backgroundColor: '#ffffff',
                  cursor: 'crosshair',
                  display: 'block',
                  maxWidth: '100%',
                  touchAction: 'none',
                }}
              />

              <div className="row wrap" style={{ gap: '0.5rem', marginTop: '0.6rem' }}>
                <button
                  type="button"
                  className="btn small"
                  onClick={clearCanvas}
                >
                  🧹 Clear Pad
                </button>
                <button
                  type="button"
                  className="btn small primary"
                  disabled={!hasDrawnOnCanvas}
                  onClick={applyDrawnSignature}
                >
                  ✓ Apply Drawn Signature
                </button>

                <label className="btn small" style={{ cursor: 'pointer', marginLeft: 'auto' }}>
                  📁 Upload Signature File
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleSignatureUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            {/* Current Active Signature Preview */}
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.9rem' }}>Current Active Signature &amp; Stamp:</strong>
                {f.signatureDataUrl && (
                  <button
                    type="button"
                    className="btn small danger"
                    onClick={() => setF({ ...f, signatureDataUrl: '' })}
                  >
                    🗑️ Remove
                  </button>
                )}
              </div>

              <div style={{ marginTop: '0.5rem', minHeight: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #cbd5e1', borderRadius: '4px', background: '#fafafa' }}>
                {f.signatureDataUrl ? (
                  <img
                    src={f.signatureDataUrl}
                    alt="Active Signature Preview"
                    style={{ maxHeight: '60px', maxWidth: '200px', objectFit: 'contain' }}
                  />
                ) : (
                  <span className="muted small">No digital signature applied (physically signed with pen on paper)</span>
                )}
              </div>
            </div>

            <Field label="Official Seal Stamp Label Text (printed in digital stamp badge)">
              <input
                value={f.stampText || ''}
                onChange={(e) => setF({ ...f, stampText: e.target.value })}
                placeholder="e.g. VERIFIED &amp; DIGITALLY SIGNED"
                maxLength={200}
              />
            </Field>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={f.showSignatureOnPrint !== '0'}
                onChange={(e) => setF({ ...f, showSignatureOnPrint: e.target.checked ? '1' : '0' })}
              />
              <span style={{ fontSize: '0.9rem' }}>Show digital signature and official stamp on printed documents</span>
            </label>
          </div>
        )}

        {/* Tab 5: Letterhead & Stationery */}
        {activeTab === 'letterhead' && (
          <div className="card stack">
            <h2 style={{ fontSize: '1.15rem', margin: '0 0 0.5rem 0' }}>Letterhead Layout &amp; Stationery</h2>

            <Field label="Letterhead Header Layout Style">
              <select
                value={f.headerLayout || 'centered'}
                onChange={(e) => setF({ ...f, headerLayout: e.target.value as any })}
              >
                <option value="centered">🏛️ Centered (Classic symmetric letterhead, centered logo and titles)</option>
                <option value="split">⚖️ Split Two-Column (Left: Clinic brand &amp; address · Right: Doctor credentials &amp; contact)</option>
                <option value="modern">💎 Modern Contemporary (Navy accent divider bar, brand logo, right doctor credentials)</option>
              </select>
            </Field>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={f.preprintedStationery === '1'}
                  onChange={(e) => setF({ ...f, preprintedStationery: e.target.checked ? '1' : '0' })}
                />
                <span>Default to pre-printed physical letterhead paper</span>
              </label>
              <p className="muted small" style={{ margin: '0.25rem 0 0.5rem 1.4rem' }}>
                When enabled, the computerized letterhead header is automatically omitted on physical prints, preserving exact blank space for your clinic&apos;s physical pre-printed letterhead paper.
              </p>

              {f.preprintedStationery === '1' && (
                <div style={{ marginLeft: '1.4rem', marginTop: '0.4rem', maxWidth: '300px' }}>
                  <Field label="Top Blank Offset for Pre-printed Paper (in mm)">
                    <input
                      type="number"
                      min={10}
                      max={150}
                      value={f.topMarginMm || '40'}
                      onChange={(e) => setF({ ...f, topMarginMm: e.target.value })}
                      placeholder="e.g. 40"
                    />
                  </Field>
                </div>
              )}
            </div>

            <Field label="Custom Document Footer Disclaimer / Emergency Notice">
              <textarea
                rows={2}
                value={f.footerText || ''}
                onChange={(e) => setF({ ...f, footerText: e.target.value })}
                placeholder="e.g. Emergency 24/7 Labor Room &amp; Casualty: +91 98765 43210 · Prescription valid for 30 days from date of issue."
                maxLength={600}
              />
            </Field>
          </div>
        )}

        {/* Live Interactive Letterhead & Document Preview */}
        <div className="card stack" style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.05rem', margin: 0, color: '#0f172a' }}>
              👁️ Live Letterhead &amp; Signature Preview
            </h2>
            <span className="small muted">Updates in real-time as you edit</span>
          </div>

          <div
            style={{
              background: '#ffffff',
              padding: '1.5rem',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            {/* Header Preview */}
            {f.preprintedStationery === '1' ? (
              <div
                style={{
                  border: '1.5px dashed #94a3b8',
                  borderRadius: '4px',
                  padding: '1rem',
                  textAlign: 'center',
                  background: '#f1f5f9',
                  color: '#475569',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                }}
              >
                📄 Pre-printed stationery active: {f.topMarginMm || '40'}mm blank header offset reserved for physical paper.
              </div>
            ) : f.headerLayout === 'split' ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                  borderBottom: '2px solid #0f172a',
                  paddingBottom: '0.75rem',
                  marginBottom: '0.75rem',
                }}
              >
                <div>
                  {f.showLogoOnPrint !== '0' && f.logoDataUrl && (
                    <img
                      src={f.logoDataUrl}
                      alt="Logo Preview"
                      style={{ maxHeight: '50px', maxWidth: '180px', objectFit: 'contain', display: 'block', marginBottom: '0.2rem' }}
                    />
                  )}
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>{f.clinicName || 'Clinic Name'}</h3>
                  {f.clinicTagline && <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: '#475569' }}>{f.clinicTagline}</div>}
                  {f.address && <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '0.2rem', whiteSpace: 'pre-line' }}>{f.address}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{f.doctorName || 'Doctor Name'}</div>
                  {f.doctorQualifications && <div style={{ fontSize: '0.76rem', color: '#475569' }}>{f.doctorQualifications}</div>}
                  {f.registrationNo && <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Reg. No: {f.registrationNo}</div>}
                  {f.phone && <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.2rem' }}>Tel: {f.phone}</div>}
                </div>
              </div>
            ) : f.headerLayout === 'modern' ? (
              <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ height: '3px', backgroundColor: '#0f172a', borderRadius: '2px', marginBottom: '0.5rem' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {f.showLogoOnPrint !== '0' && f.logoDataUrl && (
                      <img src={f.logoDataUrl} alt="Logo" style={{ maxHeight: '50px', maxWidth: '140px', objectFit: 'contain' }} />
                    )}
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{f.clinicName || 'Clinic Name'}</h3>
                      {f.clinicTagline && <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: '#475569' }}>{f.clinicTagline}</div>}
                      {f.address && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{f.address}</div>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', borderLeft: '2px solid #e2e8f0', paddingLeft: '0.75rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{f.doctorName || 'Doctor Name'}</div>
                    {f.doctorQualifications && <div style={{ fontSize: '0.75rem', color: '#475569' }}>{f.doctorQualifications}</div>}
                    {f.registrationNo && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Reg: {f.registrationNo}</div>}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                {f.showLogoOnPrint !== '0' && f.logoDataUrl && (
                  <img
                    src={f.logoDataUrl}
                    alt="Logo Preview"
                    style={{ maxHeight: '55px', maxWidth: '200px', objectFit: 'contain', margin: '0 auto 0.3rem auto', display: 'block' }}
                  />
                )}
                <h3 style={{ margin: 0, fontSize: '1.3rem' }}>{f.clinicName || 'Clinic Name'}</h3>
                {f.clinicTagline && <div style={{ fontSize: '0.82rem', fontStyle: 'italic', color: '#475569' }}>{f.clinicTagline}</div>}
                <div style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: 600, marginTop: '0.15rem' }}>
                  {[f.doctorName, f.doctorQualifications, f.registrationNo && 'Reg. No: ' + f.registrationNo].filter(Boolean).join(' · ')}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '0.15rem' }}>
                  {[f.address, f.phone && 'Phone: ' + f.phone, f.email].filter(Boolean).join(' · ')}
                </div>
              </div>
            )}

            {/* Simulated Document Body Snippet */}
            <div style={{ padding: '0.75rem 0', color: '#64748b', fontSize: '0.82rem', borderBottom: '1px dashed #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span><strong>Patient:</strong> Shobha Nambiar (32 Yrs / F)</span>
                <span><strong>Date:</strong> {new Date().toISOString().slice(0, 10)}</span>
              </div>
              <div style={{ fontStyle: 'italic' }}>
                ℞ Tab. Folic Acid 5mg · 1 tab once daily · 30 days
              </div>
            </div>

            {/* Signature & Stamp Preview */}
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <SignatureBlock
                clinic={f}
                signatoryName={f.doctorName || 'Doctor Name'}
                qualifications={f.doctorQualifications}
                regNo={f.registrationNo}
                designation="Consultant In-Charge"
                style={{ marginTop: 0 }}
              />
            </div>

            {/* Footer Preview */}
            {f.footerText && (
              <div style={{ marginTop: '1rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0', fontSize: '0.75rem', fontStyle: 'italic', color: '#64748b', textAlign: 'center' }}>
                {f.footerText}
              </div>
            )}
          </div>
        </div>

        <div>
          <button className="btn primary" disabled={busy} style={{ minWidth: '140px' }}>
            {busy ? 'Saving…' : '💾 Save Settings'}
          </button>
        </div>
      </form>

      <SecurityPanel />
      <BackupPanel />
    </div>
  );
}
