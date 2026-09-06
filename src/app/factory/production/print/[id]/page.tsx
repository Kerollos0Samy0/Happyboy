"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '../../../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CheckCircle, AlertCircle, ArrowRight, Printer } from 'lucide-react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';

export default function PrintProductionOrderPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const docRef = doc(db, 'factory_production_orders', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setOrder({ id: snap.id, ...snap.data() });
        } else {
          setError('??? ??????? ??? ?????.');
        }
      } catch (err) {
        console.error(err);
        setError('??? ??? ????? ??? ????????.');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchOrder();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="p-20 text-center text-gray-500 font-bold">???? ????? ??? ???????...</div>;
  }

  if (error || !order) {
    return (
      <div className="max-w-xl mx-auto p-10 bg-red-50 text-red-600 rounded-xl mt-10 text-center shadow">
        <AlertCircle size={48} className="mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-4">{error}</h2>
        <Link href="/factory/dashboard" className="bg-white px-4 py-2 rounded shadow text-gray-800">?????? ?????</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-20" dir="rtl">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm print:hidden">
        <Link href="/factory/dashboard" className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600">
          <ArrowRight size={24} />
        </Link>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2">
            <Printer size={18} /> ????? ??? ???????
          </button>
        </div>
      </div>

      {/* A4 Print Ticket Container */}
      <div className="bg-white p-8 shadow-lg print:shadow-none print:p-0 w-full mx-auto flex flex-col" style={{ minHeight: '297mm' }}>
        
        {/* Header Ticket */}
        <div className="border-4 border-gray-800 p-4 mb-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h1 className="text-3xl font-black mb-2 text-gray-900">??? ????? ???? (?????)</h1>
              <div className="grid grid-cols-2 gap-4 mt-4 text-lg">
                <div className="font-bold border-b border-gray-300 pb-1">???????: <span className="font-normal">{order.modelName}</span></div>
                <div className="font-bold border-b border-gray-300 pb-1">??????: <span className="font-normal">{order.totalQuantity} ????</span></div>
                <div className="font-bold border-b border-gray-300 pb-1">???????: <span className="font-normal">{order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('ar-EG') : new Date().toLocaleDateString('ar-EG')}</span></div>
              </div>
            </div>
            
            <div className="w-32 flex flex-col items-center border-r-2 pr-4 ml-4">
              <QRCodeSVG value={order.id} size={100} />
              <span className="text-xs font-mono mt-2">{order.id.slice(-6).toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-6 flex-1">
          {/* Image Section */}
          <div className="w-1/3 flex flex-col">
            <div className="border-2 border-gray-400 h-80 relative flex items-center justify-center p-2 mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {order.modelImage ? <img src={order.modelImage} alt="Model" className="w-full h-full object-contain" /> : <div className="text-gray-400">?? ???? ????</div>}
            </div>
            <div className="border border-gray-400 p-3 bg-gray-50 flex-1 flex flex-col">
              <h3 className="font-bold border-b pb-1 mb-2 text-lg">???? ??????</h3>
              <p className="text-base mb-2"><strong>?????:</strong> {order.fabricType || '---'}</p>
              <p className="text-base mb-2"><strong>?????:</strong> {order.fabricColor || '---'}</p>
              <p className="text-base mb-2"><strong>??????:</strong> {order.fabricSupplier || '---'}</p>
              
              {/* Swatches Section */}
              <div className="mt-auto pt-4 pb-2 flex justify-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-[2cm] h-[2cm] border-2 border-gray-400 bg-white shadow-inner"></div>
                  <span className="text-xs font-bold text-gray-600">??????</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-[2cm] h-[2cm] border-2 border-gray-400 bg-white shadow-inner"></div>
                  <span className="text-xs font-bold text-gray-600">??????</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stages Grid */}
          <div className="w-2/3 grid grid-cols-2 gap-4 h-fit">
            
            <div className="border border-gray-400 p-3 flex flex-col col-span-2">
              <h3 className="font-bold border-b border-gray-300 pb-1 mb-2 bg-gray-100 px-1 text-lg">?? ??? ???? ??????</h3>
              <p className="text-base min-h-[140px] whitespace-pre-wrap">{order.cuttingNotes || '- ??????:\n- ??????:'}</p>
            </div>
            
            <div className="border border-gray-400 p-3 flex flex-col">
              <h3 className="font-bold border-b border-gray-300 pb-1 mb-2 bg-gray-100 px-1 text-lg">??? ??? ??????? ???????</h3>
              <p className="text-base mb-1"><strong>??? ???????:</strong> {order.printingType || '????'}</p>
              <p className="text-base min-h-[80px] whitespace-pre-wrap">{order.printingDetails || '- ??????:\n- ??????:'}</p>
            </div>

            <div className="border border-gray-400 p-3 flex flex-col">
              <h3 className="font-bold border-b border-gray-300 pb-1 mb-2 bg-gray-100 px-1 text-lg">?? ??? ?????</h3>
              <p className="text-base min-h-[80px] whitespace-pre-wrap">{order.pressingNotes || '- ??????:\n- ??????:'}</p>
            </div>

            <div className="border border-gray-400 p-3 flex flex-col">
              <h3 className="font-bold border-b border-gray-300 pb-1 mb-2 bg-gray-100 px-1 text-lg">?? ??? ???????</h3>
              <p className="text-base min-h-[80px] whitespace-pre-wrap">{order.pairingNotes || '- ??????:\n- ??????:'}</p>
            </div>

            <div className="border border-gray-400 p-3 flex flex-col">
              <h3 className="font-bold border-b border-gray-300 pb-1 mb-2 bg-gray-100 px-1 text-lg">?? ??? ????? (???????)</h3>
              <p className="text-base min-h-[80px] whitespace-pre-wrap">{order.sewingNotes || '- ??????:\n- ??????:'}</p>
            </div>

            <div className="border border-gray-400 p-3 col-span-2 flex flex-col">
              <h3 className="font-bold border-b border-gray-300 pb-1 mb-2 bg-gray-100 px-1 text-lg">?? ??????? ???? (?????? ?????? ?????)</h3>
              <p className="text-base min-h-[100px] whitespace-pre-wrap">{order.generalNotes || '---'}</p>
            </div>

          </div>
        </div>
        
        {/* Signatures */}
        <div className="mt-auto pt-8 flex justify-between border-t-2 border-dashed border-gray-400 px-10 pb-8">
          <div className="text-center"><p className="font-bold text-lg mb-8">????? ???? ???????</p><p>.................................</p></div>
          <div className="text-center"><p className="font-bold text-lg mb-8">????? ???? ??????</p><p>.................................</p></div>
          <div className="text-center"><p className="font-bold text-lg mb-8">????? ???? ??????</p><p>.................................</p></div>
        </div>

      </div>
      
      <style jsx global>{
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .max-w-4xl > div:nth-child(2), .max-w-4xl > div:nth-child(2) * {
            visibility: visible;
          }
          .max-w-4xl > div:nth-child(2) {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      }</style>
    </div>
  );
}
