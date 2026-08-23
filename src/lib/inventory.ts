import { db } from './firebase';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const deductInventory = async (items: any[], orderNumber?: string, employeeName?: string) => {
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

          // Log movement
          await addDoc(collection(db, "inventory_logs"), {
            productId,
            modelNumber: data.modelNumber,
            productName: data.name,
            colorName: item.selectedColor,
            change: -qtyToDeduct,
            newQuantity: updatedColors[cIndex].quantity,
            reason: orderNumber ? `فاتورة رقم ${orderNumber}` : "فاتورة مبيعات",
            employeeName: employeeName || "Unknown",
            createdAt: serverTimestamp()
          });
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


export const restoreInventory = async (items: any[], orderNumber?: string, employeeName?: string) => {
  const grouped: Record<string, any[]> = {};
  for (const item of items) {
    // some places use productId directly instead of id, so we check both
    const pId = item.id || item.productId;
    if (!grouped[pId]) grouped[pId] = [];
    grouped[pId].push(item);
  }

  for (const productId of Object.keys(grouped)) {
    try {
      const prodRef = doc(db, "products", productId);
      const snap = await getDoc(prodRef);
      if (!snap.exists()) continue;

      const data = snap.data();
      let updatedColors = data.colors ? [...data.colors] : [];
      
      for (const item of grouped[productId]) {
        const qtyToRestore = item.quantity || 1;
        const cIndex = updatedColors.findIndex((c: any) => c.name === item.selectedColor);
        if (cIndex !== -1) {
          const currentQty = Number(updatedColors[cIndex].quantity) || 0;
          updatedColors[cIndex] = {
            ...updatedColors[cIndex],
            quantity: currentQty + qtyToRestore
          };

          await addDoc(collection(db, "inventory_logs"), {
            productId,
            modelNumber: data.modelNumber,
            productName: data.name,
            colorName: item.selectedColor,
            change: qtyToRestore,
            newQuantity: updatedColors[cIndex].quantity,
            reason: orderNumber ? `حذف فاتورة رقم ${orderNumber}` : "مرتجع فاتورة",
            employeeName: employeeName || "Unknown",
            createdAt: serverTimestamp()
          });
        }
      }

      const newTotalQty = updatedColors.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);

      await updateDoc(prodRef, {
        colors: updatedColors,
        quantity: newTotalQty
      });
    } catch (err) {
      console.error("Error restoring inventory for product", productId, err);
    }
  }
};

