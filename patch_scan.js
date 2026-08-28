const fs = require('fs');

let content = fs.readFileSync('src/app/scan/page.tsx', 'utf8');

const syncFunction = `
  const [syncing, setSyncing] = useState(false);
  const syncProducts = async () => {
    setSyncing(true);
    try {
      const snapshot = await getDocs(collection(db, "products"));
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      localStorage.setItem('offline_products', JSON.stringify(prods));
      localStorage.setItem('offline_products_time', Date.now().toString());
      alert("?? ?????? ???????? ?????! ??? ??? Offline ???? ????.");
    } catch(err) {
      console.error(err);
      alert("??? ??? ????? ????????");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const cachedTime = localStorage.getItem('offline_products_time');
    // Auto sync if older than 12 hours or doesn't exist
    if (!cachedTime || (Date.now() - Number(cachedTime) > 12 * 60 * 60 * 1000)) {
      syncProducts();
    }
  }, []);
`;

content = content.replace('const [loading, setLoading] = useState(false);', 'const [loading, setLoading] = useState(false);\n' + syncFunction);

const scanReplacement = `
    try {
      const cachedProductsStr = localStorage.getItem('offline_products');
      if (cachedProductsStr) {
        const cachedProducts = JSON.parse(cachedProductsStr);
        let foundProduct = null;
        for (const p of cachedProducts) {
          if (p.barcodes && p.barcodes.includes(barcode)) {
            foundProduct = p;
            break;
          }
        }
        
        if (foundProduct) {
          const matched = foundProduct.colors.find((c:any) => c.barcode === barcode) || foundProduct.colors[0];
          checkDuplicateAndProceed(foundProduct, matched);
          setLoading(false);
          return;
        }
      }
      
      const q = query(collection(db, "products"), where("barcodes", "array-contains", barcode));
`;

content = content.replace('const q = query(collection(db, "products"), where("barcodes", "array-contains", barcode));', scanReplacement);

const searchReplacement = `
    try {
      const cachedProductsStr = localStorage.getItem('offline_products');
      if (cachedProductsStr) {
        const cachedProducts = JSON.parse(cachedProductsStr);
        const foundProduct = cachedProducts.find((p:any) => p.modelNumber == searchModel.trim());
        
        if (foundProduct) {
          setScannedResult(searchModel);
          const defaultColor = foundProduct.colors[0];
          checkDuplicateAndProceed(foundProduct, defaultColor);
          setLoading(false);
          return;
        }
      }
      
      const q = query(collection(db, "products"), where("modelNumber", "==", searchModel.trim()));
`;

content = content.replace('const q = query(collection(db, "products"), where("modelNumber", "==", searchModel.trim()));', searchReplacement);

const buttonReplacement = `
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => router.push('/cart')} className="btn btn-secondary relative">
          ?? ????????
          {Object.keys(cartStats).length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
              {Object.values(cartStats).reduce((a, b) => a + b, 0)}
            </span>
          )}
        </button>
        <button onClick={syncProducts} disabled={syncing} className="btn bg-blue-500 text-white font-bold px-4 py-2 rounded-lg">
          {syncing ? "???? ????????..." : "?? ?????? (Offline)"}
        </button>
      </div>
      <h1 className="text-3xl font-bold mb-4 text-center">??? ????????</h1>
`;

content = content.replace(/<div className="flex justify-between items-center mb-6">[\s\S]*?<h1 className="text-3xl font-bold mb-4 text-center">??? ????????<\/h1>/, buttonReplacement);

fs.writeFileSync('src/app/scan/page.tsx', content);
