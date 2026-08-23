
import { db } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export const deductInventory = async (items: any[]) => {
  const grouped: Record<string, any[]> = {};
  for (const item of items) {
    if (!grouped[item.id]) grouped[item.id] = [];
    grouped[item.id].push(item);
  }

  for (const productId of Object.keys(grouped)) {
    try {
      const prodRef = doc(db, 'products', productId);
      const snap = await getDoc(prodRef);
      if (!snap.exists()) continue;

      const data = snap.data();
      let updatedColors = data.colors ? [...data.colors] : [];
      
      for (const item of grouped[productId]) {
        const qtyToDeduct = item.quantity || 1;
        const cIndex = updatedColors.findIndex((c: any) => c.name === item.selectedColor);
        if (cIndex !== -1) {
          const currentQty = Number(updatedColors[cIndex].quantity) || 0;
          updatedColors[cIndex] = {
            ...updatedColors[cIndex],
            quantity: currentQty - qtyToDeduct
          };
        }
      }

      const newTotalQty = updatedColors.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);

      await updateDoc(prodRef, {
        colors: updatedColors,
        quantity: newTotalQty
      });
    } catch (err) {
      console.error('Error updating inventory for product', productId, err);
    }
  }
};

