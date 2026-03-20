import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const downloadTicketAsPDF = async (bookingId: string) => {
  const element = document.getElementById('movie-ticket');
  if (!element) {
    console.error('Ticket element not found');
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2, // Higher scale for better quality
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height],
    });

    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`ticket_${bookingId.toLowerCase()}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF ticket');
  }
};

export const downloadTicketAsTXT = (bookingId: string, data: any) => {
  const content = `
========================================
           CINERESERVE
      OFFICIAL MOVIE TICKET
========================================

Booking ID: #CR-${bookingId.toUpperCase()}
Movie: ${data.movie.title}
Date: ${data.showtime.date}
Time: ${data.showtime.time}
Seats: ${data.seats.join(', ')}
Customer: ${data.userName}

----------------------------------------
Order Summary:
${data.snacks.map((s: any) => `- ${s.name} (x${s.quantity}): ₹${(s.price * s.quantity).toFixed(2)}`).join('\n')}
----------------------------------------
Total Paid: ₹${data.totalAmount.toFixed(2)}

----------------------------------------
Booked On: ${new Date(data.bookingTime).toLocaleString()}
========================================
  Thank you for choosing CineReserve!
========================================
  `;

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ticket_${bookingId.toLowerCase()}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
