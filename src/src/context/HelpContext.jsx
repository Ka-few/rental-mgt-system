import React, { createContext, useContext, useState, useEffect } from 'react';
import { getArticles, getArticleDetails, updateHelpProgress, getUserHelpProgress } from '../services/helpService';
import { useAuth } from './AuthContext';

const HelpContext = createContext();

export const HelpProvider = ({ children }) => {
    const { user } = useAuth();
    const [isHelpDrawerOpen, setIsHelpDrawerOpen] = useState(false);
    const [activeTour, setActiveTour] = useState(null);
    const [helpArticles, setHelpArticles] = useState([]);
    const [completedItems, setCompletedItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            loadHelpData();
        }
    }, [user]);

    const loadHelpData = async () => {
        try {
            setLoading(true);
            const [articles, progress] = await Promise.all([
                getArticles(),
                getUserHelpProgress(user.id)
            ]);
            setHelpArticles(articles);
            setCompletedItems(progress);
        } catch (err) {
            console.error('Failed to load help data:', err);
        } finally {
            setLoading(false);
        }
    };

    const startTour = async (tourSlug) => {
        try {
            const tour = await getArticleDetails(tourSlug);
            if (tour && tour.steps && tour.steps.length > 0) {
                setActiveTour({
                    slug: tour.slug,
                    steps: tour.steps,
                    currentIndex: 0
                });
                setIsHelpDrawerOpen(false); // Close drawer when tour starts
            }
        } catch (err) {
            console.error('Failed to start tour:', err);
        }
    };

    const nextStep = () => {
        if (!activeTour) return;
        if (activeTour.currentIndex < activeTour.steps.length - 1) {
            setActiveTour({
                ...activeTour,
                currentIndex: activeTour.currentIndex + 1
            });
        } else {
            completeTour();
        }
    };

    const prevStep = () => {
        if (!activeTour) return;
        if (activeTour.currentIndex > 0) {
            setActiveTour({
                ...activeTour,
                currentIndex: activeTour.currentIndex - 1
            });
        }
    };

    const completeTour = async () => {
        if (!activeTour) return;
        try {
            await updateHelpProgress({
                user_id: user.id,
                type: 'Tour',
                target_id: activeTour.slug,
                completed: true
            });
            setActiveTour(null);
            loadHelpData(); // Refresh progress
        } catch (err) {
            console.error('Failed to complete tour:', err);
            setActiveTour(null);
        }
    };

    const skipTour = () => {
        setActiveTour(null);
    };

    const value = {
        isHelpDrawerOpen,
        setIsHelpDrawerOpen,
        activeTour,
        startTour,
        nextStep,
        prevStep,
        skipTour,
        helpArticles,
        completedItems,
        loading,
        refreshHelp: loadHelpData
    };

    return (
        <HelpContext.Provider value={value}>
            {children}
        </HelpContext.Provider>
    );
};

export const useHelp = () => {
    const context = useContext(HelpContext);
    if (!context) {
        throw new Error('useHelp must be used within a HelpProvider');
    }
    return context;
};
