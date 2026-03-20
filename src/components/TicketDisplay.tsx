import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Movie, Showtime } from '../types';

interface TicketProps {
  bookingId: string;
  userName: string;
  movie: Movie;
  showtime: Showtime;
  seats: string[];
  snacks: { name: string; quantity: number; price: number }[];
  totalAmount: number;
  bookingTime: string;
}

export const TicketDisplay: React.FC<TicketProps> = ({
  bookingId,
  userName,
  movie,
  showtime,
  seats,
  snacks,
  totalAmount,
  bookingTime
}) => {
  return (
    <div 
      id="movie-ticket" 
      className="w-[400px] border-2 rounded-3xl overflow-hidden shadow-2xl font-mono"
      style={{ 
        backgroundColor: '#ffffff', 
        borderColor: '#111827', 
        color: '#111827' 
      }}
    >
      {/* Header */}
      <div 
        className="p-6 text-center border-b-4 border-dashed"
        style={{ 
          backgroundColor: '#111827', 
          color: '#ffffff',
          borderBottomColor: 'rgba(255, 255, 255, 0.2)'
        }}
      >
        <h1 className="text-2xl font-black tracking-tighter uppercase">CineReserve</h1>
        <p className="text-[10px] tracking-[0.3em] opacity-60 mt-1">OFFICIAL MOVIE TICKET</p>
      </div>

      {/* Main Content */}
      <div className="p-8 space-y-6 relative">
        {/* Perforation Simulation */}
        <div 
          className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2" 
          style={{ backgroundColor: '#f9fafb', borderColor: '#111827' }}
        />
        <div 
          className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2" 
          style={{ backgroundColor: '#f9fafb', borderColor: '#111827' }}
        />

        <div className="space-y-1">
          <p className="text-[10px] uppercase font-bold" style={{ color: '#9ca3af' }}>Movie</p>
          <h2 className="text-xl font-black uppercase leading-none">{movie.title}</h2>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <p className="text-[10px] uppercase font-bold" style={{ color: '#9ca3af' }}>Date</p>
            <p className="font-bold">{showtime.date}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase font-bold" style={{ color: '#9ca3af' }}>Time</p>
            <p className="font-bold">{showtime.time}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <p className="text-[10px] uppercase font-bold" style={{ color: '#9ca3af' }}>Seats</p>
            <p className="font-bold">{seats.join(', ')}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase font-bold" style={{ color: '#9ca3af' }}>Total Paid</p>
            <p className="font-bold" style={{ color: '#4f46e5' }}>₹{totalAmount.toFixed(2)}</p>
          </div>
        </div>

        {snacks.length > 0 && (
          <div className="space-y-1 pt-2 border-t" style={{ borderTopColor: '#f3f4f6' }}>
            <p className="text-[10px] uppercase font-bold" style={{ color: '#9ca3af' }}>Snacks</p>
            <p className="text-xs font-bold">{snacks.map(s => `${s.name} (x${s.quantity})`).join(', ')}</p>
          </div>
        )}

        <div className="space-y-1 pt-2 border-t" style={{ borderTopColor: '#f3f4f6' }}>
          <p className="text-[10px] uppercase font-bold" style={{ color: '#9ca3af' }}>Customer</p>
          <p className="text-sm font-bold">{userName}</p>
        </div>
      </div>

      {/* Footer / QR Code */}
      <div 
        className="p-6 border-t-4 border-dashed flex items-center justify-between"
        style={{ 
          backgroundColor: '#f9fafb', 
          borderTopColor: '#e5e7eb' 
        }}
      >
        <div className="space-y-2">
          <div>
            <p className="text-[8px] uppercase font-bold" style={{ color: '#9ca3af' }}>Booking ID</p>
            <p className="text-[10px] font-black">#CR-{bookingId.toUpperCase()}</p>
          </div>
          <div>
            <p className="text-[8px] uppercase font-bold" style={{ color: '#9ca3af' }}>Booked On</p>
            <p className="text-[10px]">{new Date(bookingTime).toLocaleString()}</p>
          </div>
          {/* Barcode Simulation */}
          <div className="flex gap-0.5 mt-2 h-4">
            {[...Array(20)].map((_, i) => (
              <div 
                key={i} 
                style={{ 
                  backgroundColor: '#111827', 
                  width: Math.random() > 0.5 ? '2px' : '1px' 
                }} 
              />
            ))}
          </div>
        </div>
        <div 
          className="p-2 rounded-xl border shadow-sm"
          style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}
        >
          <QRCodeSVG value={`https://cinereserve.app/verify/${bookingId}`} size={64} />
        </div>
      </div>
    </div>
  );
};
