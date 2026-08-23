import { useState } from 'react';
import {
  Search, Filter, Upload, FileText, FileImage, FileSpreadsheet, FileCheck, Download, MoreVertical, FolderOpen,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, Badge, SectionHeader, Avatar } from '@/components/ui';
import { cn } from '@/lib/utils';
import { serviceColor } from '@/data/mockData';
import { supabase } from '@/lib/supabase';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';


  function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function guessType(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'Manual';
  if (['doc', 'docx'].includes(ext ?? '')) return 'Form';
  if (['xls', 'xlsx'].includes(ext ?? '')) return 'Schedule';
  if (['png', 'jpg', 'jpeg'].includes(ext ?? '')) return 'Drawing';
  return 'Report';
}

export function DocumentsPage() {
  const { profile } = useAuth();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('documents')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setDocs(data.map((d: any) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        size: d.size,
        category: d.category,
        by: d.profiles?.full_name ?? 'Unknown',
        file_path: d.file_path,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, []);

  const cats = ['all', ...Array.from(new Set(docs.map((d) => d.category).filter(Boolean)))];
  const filtered = docs.filter((d) =>
    (cat === 'all' || d.category === cat) && d.name.toLowerCase().includes(q.toLowerCase()),
  );

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !profile) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const path = `${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, file);
      if (uploadError) {
        alert(`Error subiendo ${file.name}: ${uploadError.message}`);
        continue;
      }
      const { error: insertError } = await supabase.from('documents').insert({
        name: file.name,
        type: guessType(file.name),
        size: formatBytes(file.size),
        category: 'Operations',
        uploaded_by: profile.id,
        file_path: path,
      });
      if (insertError) alert(`Error guardando metadatos de ${file.name}: ${insertError.message}`);
    }
    setUploading(false);
    fetchDocs();
  };

  const handleDownload = (path: string, name: string) => {
    const { data } = supabase.storage.from('documents').getPublicUrl(path);
    const a = document.createElement('a');
    a.href = data.publicUrl;
    a.download = name;
    a.target = '_blank';
    a.click();
  };

  const iconFor = (t: string) => {
    if (t === 'Manual' || t === 'Report' || t === 'Form') return FileText;
    if (t === 'Drawing') return FileImage;
    if (t === 'Schedule') return FileSpreadsheet;
    return FileCheck;
  };
  const colorFor = (t: string) => {
    if (t === 'Manual') return 'bg-red-50 text-red-600';
    if (t === 'Drawing') return 'bg-blue-50 text-blue-600';
    if (t === 'Schedule') return 'bg-emerald-50 text-emerald-600';
    if (t === 'Form') return 'bg-amber-50 text-amber-600';
    if (t === 'Report') return 'bg-violet-50 text-violet-600';
    return 'bg-ink-100 text-ink-600';
  };

  return (
    <div>
      <PageHeader
        title="Document Management"
        subtitle="Manuals, drawings, forms, and reports"
        breadcrumbs={['Home', 'Documents']}
        actions={
          <button className="btn-primary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload size={15} /> {uploading ? 'Uploading…' : 'Upload Document'}
          </button>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Upload zone */}
      <Card
        className="mb-6 border-2 border-dashed border-ink-200 bg-ink-50/30 cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="h-11 w-11 rounded-full bg-white shadow-sm flex items-center justify-center text-primary-600 mb-2"><Upload size={22} /></div>
          <div className="text-sm font-medium text-ink-800">
            {uploading ? 'Uploading…' : 'Drag and drop files here, or click to browse'}
          </div>
          <div className="text-xs text-ink-500 mt-1">PDF, DOCX, XLSX, PNG, JPG · up to 50 MB</div>
        </div>
      </Card>

      <Card pad={false} className="overflow-hidden">
        <div className="p-4 border-b border-ink-100 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents…" className="input pl-9 h-9" />
          </div>
          <div className="flex items-center gap-1.5 bg-ink-50 rounded-lg p-1 flex-wrap">
            {cats.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={cn('px-3 py-1.5 rounded-md text-xs font-semibold transition', cat === c ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800')}>{c}</button>
            ))}
          </div>
          <button className="btn-secondary h-9"><Filter size={14} /> Sort</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-ink-500">Loading documents…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-500">No documents yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px bg-ink-100">
            {filtered.map((d) => {
              const Icon = iconFor(d.type);
              return (
                <div key={d.id} className="bg-white p-4 hover:bg-ink-50/40 transition group">
                  <div className="flex items-start gap-3">
                    <div className={cn('h-11 w-11 rounded-lg flex items-center justify-center shrink-0', colorFor(d.type))}><Icon size={20} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink-900 truncate">{d.name}</div>
                      <div className="text-xs text-ink-500 mt-0.5">{d.type} · {d.size}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={serviceColor(d.category as never)}>{d.category}</Badge>
                        <span className="text-[11px] text-ink-400">by {d.by}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => handleDownload(d.file_path, d.name)} className="h-7 w-7 rounded-md hover:bg-ink-100 flex items-center justify-center text-ink-500"><Download size={14} /></button>
                      <button className="h-7 w-7 rounded-md hover:bg-ink-100 flex items-center justify-center text-ink-500"><MoreVertical size={14} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );


}
export function ProfilePage() {
  const { profile } = useAuth();
  if (!profile) return null;

  const user = {
    name: profile.full_name,
    email: profile.email,
    title: profile.title,
    phone: profile.phone,
    region: profile.region,
    initials: profile.initials,
    color: profile.avatar_color,
    joined: profile.last_login ?? 'N/A',
    jobsCompleted: 0,
    avgRating: 0,
    slaRate: 0,
  };
  return (
    <div>
      <PageHeader title="My Profile" subtitle="Personal information, performance, and preferences" breadcrumbs={['Home', 'Profile']} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-1">
          <div className="flex flex-col items-center text-center py-2">
            <Avatar initials={user.initials} color={user.color} size="lg" />
            <h2 className="text-lg font-bold text-ink-900 mt-3">{user.name}</h2>
            <p className="text-sm text-ink-500">{user.title}</p>
            <Badge className="bg-emerald-50 text-emerald-700 mt-2">Active</Badge>
            <div className="grid grid-cols-3 gap-2 w-full mt-5 pt-4 border-t border-ink-100">
              <Stat label="Jobs" value={user.jobsCompleted} />
              <Stat label="Rating" value={user.avgRating} />
              <Stat label="SLA" value={`${user.slaRate}%`} />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-ink-100 space-y-2.5">
            <InfoLine label="Email" value={user.email} />
            <InfoLine label="Phone" value={user.phone} />
            <InfoLine label="Region" value={user.region} />
            <InfoLine label="Joined" value={user.joined} />
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-5">
          <Card>
            <SectionHeader title="Personal Information" action={<button className="btn-secondary h-8 text-xs">Edit</button>} />
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Full name</label><input className="input" defaultValue={user.name} /></div>
              <div><label className="label">Email</label><input className="input" defaultValue={user.email} /></div>
              <div><label className="label">Phone</label><input className="input" defaultValue={user.phone} /></div>
              <div><label className="label">Region</label><input className="input" defaultValue={user.region} /></div>
            </div>
          </Card>
          <Card>
            <SectionHeader title="Security" />
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-ink-50"><div><div className="text-sm font-medium text-ink-900">Password</div><div className="text-xs text-ink-500">Last changed 41 days ago</div></div><button className="btn-secondary h-8 text-xs">Change</button></div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/50"><div><div className="text-sm font-medium text-ink-900">Two-factor auth</div><div className="text-xs text-ink-500">Enabled via authenticator app</div></div><Badge className="bg-emerald-50 text-emerald-700">On</Badge></div>
            </div>
          </Card>
          <Card>
            <SectionHeader title="Skills & Certifications" />
            <div className="flex flex-wrap gap-2">
              {['CCTV — Level 3', 'Access Control — Level 2', 'Fire Alarm — NFPA 72', 'Fiber Splicing', 'BMS — Siemens Desigo', 'OSHA 30', 'First Aid / CPR'].map((s) => (
                <Badge key={s} className="bg-primary-50 text-primary-700">{s}</Badge>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="text-center"><div className="text-lg font-bold text-ink-900">{value}</div><div className="text-xs text-ink-500">{label}</div></div>;
}
function InfoLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between text-sm"><span className="text-ink-500">{label}</span><span className="font-medium text-ink-800">{value}</span></div>;
}

export const _folder = FolderOpen; export const _section = SectionHeader;
