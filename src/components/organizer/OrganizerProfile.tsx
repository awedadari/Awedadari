import React, { useRef, useState } from 'react';
import { db } from '../../services/db';
import { User } from '../../types';
import { Shield, Send, Building, Trophy, RefreshCw, Camera, CheckCircle2 } from 'lucide-react';

interface OrganizerProfileProps {
  user: User;
}

export const OrganizerProfile: React.FC<OrganizerProfileProps> = ({ user }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoMsg, setPhotoMsg] = useState('');
  const tournaments = db.getTournaments().filter((t) => t.organizerId === user.id);

  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setPhotoMsg('Image size too large. Please select a photo under 5MB.');
      setTimeout(() => setPhotoMsg(''), 3000);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        db.updateUserProfilePhoto(user.id, dataUrl);
        setPhotoMsg('Profile picture updated successfully!');
        setTimeout(() => setPhotoMsg(''), 3500);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Host Profile Card */}
      <div className="bg-slate-850 border border-amber-500/30 rounded-2xl p-5 text-center relative overflow-hidden shadow-lg">
        <div className="relative inline-block mx-auto group">
          <img
            src={user.profileImage}
            alt={user.name}
            className="w-20 h-20 rounded-full object-cover mx-auto border-4 border-amber-500/30 shadow-md"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-0 right-0 p-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-full shadow-md transition-all active:scale-95"
            title="Change Profile Picture"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleProfilePhotoChange}
            className="hidden"
          />
        </div>

        {photoMsg && (
          <div className="mt-2 p-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-medium flex items-center justify-center gap-1.5 max-w-xs mx-auto">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            {photoMsg}
          </div>
        )}

        <h2 className="text-lg font-bold text-white mt-3">{user.name}</h2>
        <p className="text-xs text-sky-400 font-mono flex items-center justify-center gap-1 mt-0.5">
          <Send className="w-3 h-3" />
          @{user.username}
        </p>
        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
          Telegram User ID: <strong className="text-white">{user.telegramUserId}</strong>
        </p>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-xs text-amber-300 font-bold mt-3">
          <Shield className="w-3.5 h-3.5" />
          Role: APPROVED ORGANIZER (Telegram Verified)
        </div>

      </div>

      {/* Quick Role Switcher */}
      <div className="bg-slate-850 border border-slate-750 rounded-2xl p-4 space-y-3 text-xs">
        <h3 className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-blue-400" />
          Testing & Role Simulation
        </h3>

        <p className="text-slate-400 leading-relaxed">
          Switch to <strong>PLAYER</strong> mode to test the participant flow, tournament registration, and player bracket views.
        </p>

        <button
          onClick={() => db.toggleUserRole(user.id)}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98"
        >
          <RefreshCw className="w-4 h-4 text-blue-400" />
          Switch Role to PLAYER
        </button>
      </div>
    </div>
  );
};
