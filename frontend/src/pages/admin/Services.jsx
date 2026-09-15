import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useCrud } from "@/hooks/useCrud";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMPTY = { title: "", category: "GST", description: "", price: "", image: "", imageFile: "", status: "Available" };

export default function Services() {
  const { rows, loading, create, update, remove } = useCrud("services");
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (editing) await update(editing, form); else await create(form);
    setEditing(null); setForm(EMPTY);
  };
  const edit = (r) => { setEditing(r.id); setForm({ ...EMPTY, ...r }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  return <div>
    <PageHeader title="Services" breadcrumb={["Super Admin", "Services"]} subtitle="Manage the services shown across the NTAXCO portals." />
    <form onSubmit={submit} className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm mb-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div><Label>Service name</Label><Input className="mt-1.5" value={form.title} onChange={e=>set("title",e.target.value)} placeholder="GST Registration" required /></div>
        <div><Label>Category</Label><Input className="mt-1.5" value={form.category} onChange={e=>set("category",e.target.value)} /></div>
        <div><Label>Price</Label><Input className="mt-1.5" value={form.price} onChange={e=>set("price",e.target.value)} placeholder="₹1,999" /></div>
        <div className="sm:col-span-2"><Label>Description</Label><Input className="mt-1.5" value={form.description} onChange={e=>set("description",e.target.value)} /></div>
        <div><Label>Image URL</Label><Input className="mt-1.5" value={form.image} onChange={e=>set("image",e.target.value)} placeholder="https://..." /><Label className="mt-2 block">Or upload image (PNG, JPG, JPEG, GIF, WEBP, SVG)</Label><Input className="mt-1.5" type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0]; if(f){const r=new FileReader();r.onload=()=>set("image",String(r.result));r.readAsDataURL(f)}}} />{form.image && <div className="mt-2 h-16 w-16 rounded-lg overflow-hidden border border-zinc-200 bg-zinc-100"><img src={form.image} alt="Preview" className="h-full w-full object-cover" /></div>}</div>
        <div><Label>Status</Label><Input className="mt-1.5" value={form.status} onChange={e=>set("status",e.target.value)} placeholder="Available / Active / Hidden" /></div>
      </div>
      <div className="flex gap-2 mt-4"><Button type="submit" className="bg-royal text-white"><Plus className="h-4 w-4 mr-1.5" />{editing ? "Update service" : "Add service"}</Button>{editing && <Button type="button" variant="outline" onClick={()=>{setEditing(null);setForm(EMPTY)}}>Cancel</Button>}</div>
    </form>
    <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-5 border-b border-zinc-100"><h3 className="font-heading font-bold">Service catalog</h3></div>
      {loading ? <div className="p-6 text-sm text-zinc-500">Loading services...</div> : <div className="divide-y divide-zinc-100">{rows.map(r=><div key={r.id} className="p-4 flex items-center justify-between gap-4">{r.image && <div className="h-12 w-12 rounded-lg overflow-hidden shrink-0 border border-zinc-200 bg-zinc-100"><img src={r.image} alt={r.title||r.name||"Service"} className="h-full w-full object-cover" /></div>}<div className="min-w-0 flex-1"><p className="font-semibold text-zinc-900">{r.title || r.name}</p><p className="text-xs text-zinc-500">{r.category || "General"} · {r.price || "Price on request"}</p><p className="text-sm text-zinc-600 mt-1">{r.description || "No description"}</p></div><div className="flex gap-2 shrink-0"><Button variant="outline" size="sm" onClick={()=>edit(r)}><Pencil className="h-4 w-4 mr-1"/>Edit</Button><Button variant="outline" size="sm" onClick={()=>remove(r.id)}><Trash2 className="h-4 w-4 mr-1"/>Delete</Button></div></div>)}{!rows.length && <div className="p-6 text-sm text-zinc-500">No services found.</div>}</div>}
    </div>
  </div>;
}
