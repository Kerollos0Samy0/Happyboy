export default function Home() {
  return (
    <div className="animate-fade-in flex flex-col items-center justify-center mt-6">
      <div className="card w-full" style={{ maxWidth: '600px', textAlign: 'center' }}>
        <h1 className="mb-2" style={{ color: 'var(--primary)' }}>مرحباً بك في Stock HappyBoy</h1>
        <p className="mb-6">المنصة المتكاملة لإدارة المصنع والمتاجر</p>
        
        <div className="grid grid-cols-2 gap-4 mt-4">
          <a href="/scan" className="btn btn-primary" style={{ padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <span style={{ fontSize: '2rem' }}>📱</span>
            <span>بوابة العملاء (مسح باركود)</span>
          </a>
          
          <a href="/dashboard" className="btn btn-secondary" style={{ padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <span style={{ fontSize: '2rem' }}>📊</span>
            <span>لوحة تحكم الإدارة</span>
          </a>
        </div>
      </div>
    </div>
  );
}
