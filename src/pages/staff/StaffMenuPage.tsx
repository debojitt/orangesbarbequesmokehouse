import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, Eye, EyeOff, ChefHat, Flame, Wand2, Loader2, Image, ImageOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const StaffMenu = () => {
  const queryClient = useQueryClient();
  const [showItemForm, setShowItemForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [generatingDescriptions, setGeneratingDescriptions] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [imageProgress, setImageProgress] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');

  const [itemForm, setItemForm] = useState({
    name: '', description: '', serving_info: '', base_price: '', category_id: '',
    is_veg: true, is_bestseller: false, is_chef_special: false, is_daily_special: false,
    variants: [] as { name: string; price: string; serves_count: string }[],
  });
  const [categoryForm, setCategoryForm] = useState({ name: '', icon: '', display_order: '0' });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories-all'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('*').order('display_order');
      return data || [];
    },
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu-items-staff'],
    queryFn: async () => {
      const { data: items } = await supabase.from('menu_items').select('*, item_variants(*)');
      return items || [];
    },
  });

  const filteredMenuItems = filterCategory
    ? menuItems.filter((item: any) => item.category_id === filterCategory)
    : menuItems;

  const saveItem = useMutation({
    mutationFn: async () => {
      const payload = {
        name: itemForm.name,
        description: itemForm.description || null,
        serving_info: itemForm.serving_info || null,
        base_price: parseFloat(itemForm.base_price) || 0,
        category_id: itemForm.category_id || null,
        is_veg: itemForm.is_veg,
        is_bestseller: itemForm.is_bestseller,
        is_chef_special: itemForm.is_chef_special,
        is_daily_special: itemForm.is_daily_special,
      };

      let itemId: string;
      if (editingItem) {
        await supabase.from('menu_items').update(payload).eq('id', editingItem.id);
        itemId = editingItem.id;
        await supabase.from('item_variants').delete().eq('menu_item_id', itemId);
      } else {
        const { data } = await supabase.from('menu_items').insert(payload).select().single();
        if (!data) throw new Error('Failed to create item');
        itemId = data.id;
      }

      if (itemForm.variants.length > 0) {
        const variants = itemForm.variants.map((v) => ({
          menu_item_id: itemId,
          name: v.name,
          price: parseFloat(v.price) || 0,
          serves_count: parseInt(v.serves_count) || 1,
        }));
        await supabase.from('item_variants').insert(variants);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items-staff'] });
      setShowItemForm(false);
      resetItemForm();
      toast.success(editingItem ? 'Item updated' : 'Item added');
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('menu_items').delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items-staff'] });
      toast.success('Item deleted');
    },
  });

  const toggleAvailability = useMutation({
    mutationFn: async ({ id, available }: { id: string; available: boolean }) => {
      await supabase.from('menu_items').update({ is_available: available }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menu-items-staff'] }),
  });

  const toggleImageHidden = useMutation({
    mutationFn: async ({ id, hidden }: { id: string; hidden: boolean }) => {
      await supabase.from('menu_items').update({ image_hidden: hidden }).eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items-staff'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
    },
  });

  // Global hide-all-images toggle
  const { data: globalHideSetting } = useQuery({
    queryKey: ['app-setting', 'images_hidden_global'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('*').eq('key', 'images_hidden_global').maybeSingle();
      return data;
    },
  });

  const globalImagesHidden = !!(globalHideSetting?.value as any)?.value;

  const toggleGlobalImages = useMutation({
    mutationFn: async (hidden: boolean) => {
      await supabase.from('app_settings').upsert({
        key: 'images_hidden_global',
        value: { value: hidden } as any,
        updated_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-setting', 'images_hidden_global'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      queryClient.invalidateQueries({ queryKey: ['global-images-hidden'] });
      toast.success('Image visibility updated');
    },
  });

  const saveCategory = useMutation({
    mutationFn: async () => {
      const payload = {
        name: categoryForm.name,
        icon: categoryForm.icon || null,
        display_order: parseInt(categoryForm.display_order) || 0,
      };
      if (editingCategory) {
        await supabase.from('categories').update(payload).eq('id', editingCategory.id);
      } else {
        await supabase.from('categories').insert(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories-all'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setShowCategoryForm(false);
      setCategoryForm({ name: '', icon: '', display_order: '0' });
      setEditingCategory(null);
      toast.success(editingCategory ? 'Category updated' : 'Category added');
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('categories').delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories-all'] });
      toast.success('Category deleted');
    },
  });

  const handleGenerateAllDescriptions = async () => {
    const itemsWithoutDesc = menuItems.filter((item: any) => !item.description || item.description.trim() === '');
    if (itemsWithoutDesc.length === 0) {
      toast.info('All items already have descriptions');
      return;
    }

    setGeneratingDescriptions(true);
    let updated = 0;

    try {
      const { data } = await supabase.functions.invoke('ai-craving', {
        body: {
          action: 'generate-descriptions',
          items: itemsWithoutDesc.map((item: any) => ({
            id: item.id,
            name: item.name,
            is_veg: item.is_veg,
            category: categories.find(c => c.id === item.category_id)?.name || '',
          })),
        },
      });

      if (data?.descriptions) {
        for (const desc of data.descriptions) {
          await supabase.from('menu_items').update({ description: desc.description }).eq('id', desc.id);
          updated++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['menu-items-staff'] });
      toast.success(`Generated descriptions for ${updated} items`);
    } catch (e) {
      toast.error('Failed to generate descriptions');
    }
    setGeneratingDescriptions(false);
  };

  const handleGenerateAllImages = async () => {
    setGeneratingImages(true);
    setImageProgress('Checking items...');
    try {
      const { data: listData } = await supabase.functions.invoke('ai-craving', {
        body: { action: 'list-items-without-images' },
      });
      const missingItems = listData?.items || [];
      if (missingItems.length === 0) {
        toast.info('All items already have illustrations');
        setGeneratingImages(false);
        setImageProgress('');
        return;
      }
      let generated = 0;
      for (const item of missingItems) {
        setImageProgress(`Generating ${generated + 1}/${missingItems.length}: ${item.name}`);
        try {
          await supabase.functions.invoke('ai-craving', {
            body: { action: 'generate-illustration', item_id: item.id, item_name: item.name, is_veg: item.is_veg },
          });
          generated++;
        } catch (err) {
          console.error(`Failed to generate image for ${item.name}:`, err);
        }
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 2000));
      }
      toast.success(`Generated illustrations for ${generated} items`);
    } catch (e) {
      toast.error('Failed to generate illustrations');
    }
    setGeneratingImages(false);
    setImageProgress('');
  };

  const resetItemForm = () => {
    setItemForm({ name: '', description: '', serving_info: '', base_price: '', category_id: '', is_veg: true, is_bestseller: false, is_chef_special: false, is_daily_special: false, variants: [] });
    setEditingItem(null);
  };

  const openEditItem = (item: any) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      description: item.description || '',
      serving_info: item.serving_info || '',
      base_price: String(item.base_price),
      category_id: item.category_id || '',
      is_veg: item.is_veg,
      is_bestseller: item.is_bestseller,
      is_chef_special: item.is_chef_special,
      is_daily_special: item.is_daily_special,
      variants: (item.item_variants || []).map((v: any) => ({
        name: v.name, price: String(v.price), serves_count: String(v.serves_count || 1),
      })),
    });
    setShowItemForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Categories */}
      <div className="ios-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg text-primary">Categories</h2>
          <button
            onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', icon: '', display_order: '0' }); setShowCategoryForm(true); }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium maroon-gradient text-primary-foreground rounded-full"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {categories.map((cat) => (
            <div key={cat.id} className="bg-secondary/40 rounded-xl p-3 flex items-center justify-between">
              <span className="text-sm text-foreground truncate">{cat.icon} {cat.name}</span>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => { setEditingCategory(cat); setCategoryForm({ name: cat.name, icon: cat.icon || '', display_order: String(cat.display_order) }); setShowCategoryForm(true); }} className="p-1 text-muted-foreground hover:text-primary">
                  <Edit className="w-3 h-3" />
                </button>
                <button onClick={() => deleteCategory.mutate(cat.id)} className="p-1 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Menu Items */}
      <div className="ios-card p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-display text-lg text-primary">Menu Items ({filteredMenuItems.length})</h2>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => toggleGlobalImages.mutate(!globalImagesHidden)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full border ${globalImagesHidden ? 'border-destructive text-destructive' : 'border-primary text-primary'}`}
              title="Show or hide ALL menu images at once"
            >
              {globalImagesHidden ? <ImageOff className="w-3 h-3" /> : <Image className="w-3 h-3" />}
              {globalImagesHidden ? 'Images: OFF' : 'Images: ON'}
            </button>
            <button
              onClick={handleGenerateAllDescriptions}
              disabled={generatingDescriptions}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-primary text-primary rounded-full disabled:opacity-50"
            >
              {generatingDescriptions ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
              AI Descriptions
            </button>
            <button
              onClick={handleGenerateAllImages}
              disabled={generatingImages}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-primary text-primary rounded-full disabled:opacity-50"
            >
              {generatingImages ? <Loader2 className="w-3 h-3 animate-spin" /> : <Image className="w-3 h-3" />}
              AI Images
            </button>
            <button
              onClick={() => { resetItemForm(); setShowItemForm(true); }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium maroon-gradient text-primary-foreground rounded-full"
            >
              <Plus className="w-3 h-3" /> Add Item
            </button>
          </div>
          {imageProgress && (
            <p className="text-xs text-muted-foreground mt-1">{imageProgress}</p>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          <button onClick={() => setFilterCategory('')} className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${!filterCategory ? 'maroon-gradient text-primary-foreground' : 'bg-secondary/60 text-muted-foreground'}`}>
            All
          </button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setFilterCategory(c.id)} className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${filterCategory === c.id ? 'maroon-gradient text-primary-foreground' : 'bg-secondary/60 text-muted-foreground'}`}>
              {c.icon} {c.name}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filteredMenuItems.map((item: any) => (
            <div key={item.id} className={`bg-secondary/20 rounded-xl p-3 flex items-center justify-between ${!item.is_available ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={item.item_variants?.length > 0 ? 'neutral-badge' : item.is_veg ? 'veg-badge' : 'nonveg-badge'} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{item.name}</span>
                    {item.is_bestseller && <Flame className="w-3 h-3 text-primary flex-shrink-0" />}
                    {item.is_chef_special && <ChefHat className="w-3 h-3 text-primary flex-shrink-0" />}
                  </div>
                  <span className="text-xs text-muted-foreground">₹{item.base_price}</span>
                  {!item.description && <span className="text-[10px] text-amber-500 ml-2">No description</span>}
                  {item.image_hidden && <span className="text-[10px] text-muted-foreground ml-2">• Image hidden</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => toggleImageHidden.mutate({ id: item.id, hidden: !item.image_hidden })}
                  className="p-1.5 text-muted-foreground hover:text-primary"
                  title={item.image_hidden ? 'Show image' : 'Hide image'}
                >
                  {item.image_hidden ? <ImageOff className="w-4 h-4" /> : <Image className="w-4 h-4" />}
                </button>
                <button onClick={() => toggleAvailability.mutate({ id: item.id, available: !item.is_available })} className="p-1.5 text-muted-foreground hover:text-primary">
                  {item.is_available ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button onClick={() => openEditItem(item)} className="p-1.5 text-muted-foreground hover:text-primary">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => deleteItem.mutate(item.id)} className="p-1.5 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Item Form Dialog */}
      <Dialog open={showItemForm} onOpenChange={(o) => { if (!o) resetItemForm(); setShowItemForm(o); }}>
        <DialogContent className="glass-panel-strong border-border rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-primary">{editingItem ? 'Edit Item' : 'Add Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="Item Name *" className="w-full px-4 py-2.5 bg-secondary text-foreground border border-border rounded-xl text-sm focus:outline-none focus:border-primary" />
            <textarea value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} placeholder="Description" className="w-full px-4 py-2.5 bg-secondary text-foreground border border-border rounded-xl text-sm focus:outline-none focus:border-primary h-20 resize-none" />
            <input value={itemForm.serving_info} onChange={(e) => setItemForm({ ...itemForm, serving_info: e.target.value })} placeholder="Serving Info (e.g., Serves 2)" className="w-full px-4 py-2.5 bg-secondary text-foreground border border-border rounded-xl text-sm focus:outline-none focus:border-primary" />
            <input type="number" value={itemForm.base_price} onChange={(e) => setItemForm({ ...itemForm, base_price: e.target.value })} placeholder="Base Price *" className="w-full px-4 py-2.5 bg-secondary text-foreground border border-border rounded-xl text-sm focus:outline-none focus:border-primary" />
            <select value={itemForm.category_id} onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })} className="w-full px-4 py-2.5 bg-secondary text-foreground border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
              <option value="">No Category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex flex-wrap gap-3">
              {[
                { key: 'is_veg', label: 'Veg' },
                { key: 'is_bestseller', label: 'Bestseller' },
                { key: 'is_chef_special', label: "Chef's Special" },
                { key: 'is_daily_special', label: 'Daily Special' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(itemForm as any)[key]}
                    onChange={(e) => setItemForm({ ...itemForm, [key]: e.target.checked })}
                    className="accent-primary w-4 h-4 rounded"
                  />
                  {label}
                </label>
              ))}
            </div>

            {/* Variants */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Variants</span>
                <button onClick={() => setItemForm(p => ({ ...p, variants: [...p.variants, { name: '', price: '', serves_count: '1' }] }))} className="text-xs text-primary hover:underline">+ Add Variant</button>
              </div>
              {itemForm.variants.map((v, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input value={v.name} onChange={(e) => { const vars = [...itemForm.variants]; vars[i].name = e.target.value; setItemForm({ ...itemForm, variants: vars }); }} placeholder="Name" className="flex-1 px-3 py-1.5 bg-secondary text-foreground border border-border rounded-lg text-xs focus:outline-none focus:border-primary" />
                  <input type="number" value={v.price} onChange={(e) => { const vars = [...itemForm.variants]; vars[i].price = e.target.value; setItemForm({ ...itemForm, variants: vars }); }} placeholder="Price" className="w-20 px-3 py-1.5 bg-secondary text-foreground border border-border rounded-lg text-xs focus:outline-none focus:border-primary" />
                  <input type="number" value={v.serves_count} onChange={(e) => { const vars = [...itemForm.variants]; vars[i].serves_count = e.target.value; setItemForm({ ...itemForm, variants: vars }); }} placeholder="Serves" className="w-16 px-3 py-1.5 bg-secondary text-foreground border border-border rounded-lg text-xs focus:outline-none focus:border-primary" />
                  <button onClick={() => setItemForm({ ...itemForm, variants: itemForm.variants.filter((_, j) => j !== i) })} className="text-destructive text-xs px-2">✕</button>
                </div>
              ))}
            </div>

            <button onClick={() => saveItem.mutate()} disabled={!itemForm.name || !itemForm.base_price} className="w-full py-2.5 maroon-gradient text-primary-foreground font-medium rounded-xl disabled:opacity-50">
              {editingItem ? 'Update Item' : 'Add Item'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Form Dialog */}
      <Dialog open={showCategoryForm} onOpenChange={setShowCategoryForm}>
        <DialogContent className="glass-panel-strong border-border rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-primary">{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} placeholder="Category Name *" className="w-full px-4 py-2.5 bg-secondary text-foreground border border-border rounded-xl text-sm focus:outline-none focus:border-primary" />
            <input value={categoryForm.icon} onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })} placeholder="Icon (emoji)" className="w-full px-4 py-2.5 bg-secondary text-foreground border border-border rounded-xl text-sm focus:outline-none focus:border-primary" />
            <input type="number" value={categoryForm.display_order} onChange={(e) => setCategoryForm({ ...categoryForm, display_order: e.target.value })} placeholder="Display Order" className="w-full px-4 py-2.5 bg-secondary text-foreground border border-border rounded-xl text-sm focus:outline-none focus:border-primary" />
            <button onClick={() => saveCategory.mutate()} disabled={!categoryForm.name} className="w-full py-2.5 maroon-gradient text-primary-foreground font-medium rounded-xl disabled:opacity-50">
              {editingCategory ? 'Update' : 'Add Category'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffMenu;
