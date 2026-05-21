import { Router, Request, Response } from 'express';
import { getAllSettings, setSetting, getSetting, getHistory } from '../db';
import { broadcastLibraryUpdate } from '../websocket';

export const settingsRouter = Router();

settingsRouter.get('/', (req: Request, res: Response) => {
  try {
    const settings = getAllSettings();
    const libraryPath = getSetting('libraryPath', '');
    const showPlatformBadges = getSetting('showPlatformBadges', 'true') === 'true';
    res.json({ ...settings, libraryPath, showPlatformBadges });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
});

settingsRouter.post('/', (req: Request, res: Response) => {
  try {
    const { libraryPath, showPlatformBadges } = req.body;
    
    if (libraryPath !== undefined) {
      setSetting('libraryPath', libraryPath);
      broadcastLibraryUpdate();
    }
    
    if (showPlatformBadges !== undefined) {
      setSetting('showPlatformBadges', String(showPlatformBadges));
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Failed to update settings' });
  }
});

settingsRouter.put('/:key', (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ message: 'Value is required' });
    }
    
    setSetting(key, String(value));
    res.json({ key, value: String(value) });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ message: 'Failed to update setting' });
  }
});

settingsRouter.get('/history', (req: Request, res: Response) => {
  try {
    const history = getHistory();
    res.json({ history });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ message: 'Failed to fetch history' });
  }
});
