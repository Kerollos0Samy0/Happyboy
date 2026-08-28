import { db } from './firebase';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const deductInventory = async (items: any[], orderNumber?: string, employeeName?: string) => {
  const grouped: Record<string, any[]> = {};
  for (const item of items) {
    if (!grouped[item.id]) grouped[item.id] = [];
    grouped[item.id].push(item);
  }

  await Promise.all(Object.keys(grouped).map(async (productId) => {
    try {
      const prodRef = doc(db, 'products', productId);
      const snap = await getDoc(prodRef);
      if (!snap.exists()) return;

      const data = snap.data();
      let updatedColors = data.colors ? [...data.colors] : [];
      
      const logPromises = [];

      for (const item of grouped[productId]) {
        let qtyToDeduct = item.quantity || 1;
        if (item.isSeri) {
          const category = data.modelNumber ? parseInt(data.modelNumber.replace(/\\D/g, ''), 10) : NaN;
          let sizesCount = 1;
          if (!isNaN(category)) {
            if ((category >= 5 && category <= 90) || (category >= 500 && category <= 589) || (category >= 3000 && category <= 3099) || (category >= 4000 && category <= 4099) || (data.name && (data.name.includes('بيبي') || data.name.includes('سمر')))) {
              sizesCount = 4;
            } else if (item.sizes && item.sizes.length > 0) {
              sizesCount = item.sizes.length;
            }
          }
          qtyToDeduct = qtyToDeduct * sizesCount;
        }

        const cIndex = updatedColors.findIndex((c: any) => c.name === item.selectedColor);
        if (cIndex !== -1) {
          const currentQty = Number(updatedColors[cIndex].quantity) || 0;
          updatedColors[cIndex] = {
            ...updatedColors[cIndex],
            quantity: currentQty - qtyToDeduct
          };

          // Log movement concurrently
          logPromises.push(addDoc(collection(db, "inventory_logs"), {
            productId,
            modelNumber: data.modelNumber,
            productName: data.name,
            colorName: item.selectedColor,
            change: -qtyToDeduct,
            newQuantity: updatedColors[cIndex].quantity,
            reason: orderNumber ? `فاتورة رقم ${orderNumber}` : "فاتورة مبيعات",
            employeeName: employeeName || "Unknown",
            createdAt: serverTimestamp()
          }));
        }
      }

      const newTotalQty = updatedColors.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);

      await Promise.all([
        updateDoc(prodRef, {
          colors: updatedColors,
          quantity: newTotalQty
        }),
        ...logPromises
      ]);
    } catch (err) {
      console.error('Error updating inventory for product', productId, err);
    }
  }));
};


export const restoreInventory = async (items: any[], orderNumber?: string, employeeName?: string) => {
  const grouped: Record<string, any[]> = {};
  for (const item of items) {
    // some places use productId directly instead of id, so we check both
    const pId = item.id || item.productId;
    if (!grouped[pId]) grouped[pId] = [];
    grouped[pId].push(item);
  }

  await Promise.all(Object.keys(grouped).map(async (productId) => {
    try {
      const prodRef = doc(db, "products", productId);
      const snap = await getDoc(prodRef);
      if (!snap.exists()) return;

      const data = snap.data();
      let updatedColors = data.colors ? [...data.colors] : [];
      
      const logPromises = [];

      for (const item of grouped[productId]) {
        let qtyToRestore = item.quantity || 1;
        if (item.isSeri) {
          const category = data.modelNumber ? parseInt(data.modelNumber.replace(/\\D/g, ''), 10) : NaN;
          let sizesCount = 1;
          if (!isNaN(category)) {
            if ((category >= 5 && category <= 90) || (category >= 500 && category <= 589) || (category >= 3000 && category <= 3099) || (category >= 4000 && category <= 4099) || (data.name && (data.name.includes('بيبي') || data.name.includes('سمر')))) {
              sizesCount = 4;
            } else if (item.sizes && item.sizes.length > 0) {
              sizesCount = item.sizes.length;
            }
          }
          qtyToRestore = qtyToRestore * sizesCount;
        }

        const cIndex = updatedColors.findIndex((c: any) => c.name === item.selectedColor);
        if (cIndex !== -1) {
          const currentQty = Number(updatedColors[cIndex].quantity) || 0;
          updatedColors[cIndex] = {
            ...updatedColors[cIndex],
            quantity: currentQty + qtyToRestore
          };

          logPromises.push(addDoc(collection(db, "inventory_logs"), {
            productId,
            modelNumber: data.modelNumber,
            productName: data.name,
            colorName: item.selectedColor,
            change: qtyToRestore,
            newQuantity: updatedColors[cIndex].quantity,
            reason: orderNumber ? `حذف فاتورة رقم ${orderNumber}` : "مرتجع فاتورة",
            employeeName: employeeName || "Unknown",
            createdAt: serverTimestamp()
          }));
        }
      }

      const newTotalQty = updatedColors.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);

      await Promise.all([
        updateDoc(prodRef, {
          colors: updatedColors,
          quantity: newTotalQty
        }),
        ...logPromises
      ]);
    } catch (err) {
      console.error("Error restoring inventory for product", productId, err);
    }
  }));
};
