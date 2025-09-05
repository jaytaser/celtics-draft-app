import React from 'react';
export default function Header(){
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="text-2xl font-bold">🏀 Celtics Ticket Draft</div>
      <a className="btn" href="/join">Join</a>
    </div>
  );
}
