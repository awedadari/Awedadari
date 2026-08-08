import { useState, useEffect } from 'react';
import { db } from '../services/db';
import { User } from '../types';

export function useDbStore() {
  const [activeUser, setActiveUser] = useState<User>(db.getActiveUser());
  const [users, setUsers] = useState<User[]>(db.getUsers());
  const [tournaments, setTournaments] = useState(db.getTournaments());
  const [loading, setLoading] = useState(db.isLoading());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unsubscribe = db.subscribe(() => {
      setActiveUser(db.getActiveUser());
      setUsers(db.getUsers());
      setTournaments(db.getTournaments());
      setLoading(db.isLoading());
      setTick((prev) => prev + 1);
    });
    return unsubscribe;
  }, []);

  return {
    activeUser,
    users,
    tournaments,
    loading,
    tick,
    db,
  };
}
