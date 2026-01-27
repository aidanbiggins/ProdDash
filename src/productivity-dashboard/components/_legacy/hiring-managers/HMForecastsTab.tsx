import React, { useMemo } from 'react';
import { HMReqRollup } from '../../../types/hmTypes';
import { SectionHeader, StatLabel, StatValue } from '../../common';

interface HMForecastsTabProps {
    reqRollups: HMReqRollup[];
}

export function HMForecastsTab({ reqRollups }: HMForecastsTabProps) {
    // Only items with forecasts
    const forecastedReqs = useMemo(() => {
        return reqRollups
            .filter(r => r.forecast && r.forecast.likelyDate)
            .sort((a, b) => new Date(a.forecast!.likelyDate!).getTime() - new Date(b.forecast!.likelyDate!).getTime());
    }, [reqRollups]);

    const stats = useMemo(() => {
        const next30 = new Date();
        next30.setDate(next30.getDate() + 30);

        return {
            totalForecasted: forecastedReqs.length,
            next30Days: forecastedReqs.filter(r => new Date(r.forecast!.likelyDate!) <= next30).length
        };
    }, [forecastedReqs]);

    if (forecastedReqs.length === 0) {
        return (
            <div className="card-bespoke p-5 text-center text-muted-foreground">
                <div className="mb-3" style={{ fontSize: '3rem' }}>📅</div>
                <h5 className="text-lg font-semibold mb-2">Insufficient Data for Forecasting</h5>
                <p className="mb-0">Add active candidates to your requisitions to generate fill date predictions.</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <div className="card-bespoke h-full">
                        <div className="card-body">
                            <div className="flex items-center mb-3">
                                <div className="rounded-full bg-accent-soft flex items-center justify-center mr-3 w-12 h-12" style={{ color: 'var(--color-accent)' }}>
                                    <i className="bi bi-bullseye text-xl"></i>
                                </div>
                                <div>
                                    <StatLabel>Total Expected Hires</StatLabel>
                                    <StatValue>{stats.totalForecasted}</StatValue>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div>
                    <div className="card-bespoke h-full">
                        <div className="card-body">
                            <div className="flex items-center mb-3">
                                <div className="rounded-full flex items-center justify-center mr-3 w-12 h-12" style={{ background: 'rgba(212, 163, 115, 0.15)', color: '#f59e0b' }}>
                                    <i className="bi bi-rocket-takeoff text-xl"></i>
                                </div>
                                <div>
                                    <StatLabel>Expected in Next 30 Days</StatLabel>
                                    <StatValue color="primary">{stats.next30Days}</StatValue>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Timeline List */}
            <div className="card-bespoke mb-4">
                <div className="card-header bg-transparent border-none pt-4 px-4 pb-0">
                    <SectionHeader
                        title="Upcoming Hiring Timeline"
                        subtitle="Projected fill dates based on current pipeline velocity"
                    />
                </div>
                <div className="card-body p-4">
                    <div className="timeline-container flex flex-col gap-3">
                        {forecastedReqs.map(req => {
                            const forecast = req.forecast!;
                            const likely = new Date(forecast.likelyDate!);
                            const daysUntil = Math.ceil((likely.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                            const isLate = daysUntil < 0;

                            return (
                                <div key={req.reqId} className="flex items-center p-3 rounded" style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-slate-200)' }}>
                                    {/* Date Badge */}
                                    <div className="mr-4 text-center" style={{ minWidth: '80px' }}>
                                        <div className={`inline-flex items-center px-3 py-1.5 rounded text-sm font-medium mb-1 ${isLate ? 'bg-red-500/15 text-red-400' : daysUntil <= 7 ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'}`}>
                                            {isLate ? (
                                                <span>Overdue</span>
                                            ) : daysUntil === 0 ? (
                                                <span>Today</span>
                                            ) : daysUntil === 1 ? (
                                                <span>Tomorrow</span>
                                            ) : (
                                                <span>{daysUntil} Days</span>
                                            )}
                                        </div>
                                        <div className="text-sm font-bold text-muted-foreground uppercase" style={{ letterSpacing: '0.05em', fontSize: '0.7rem' }}>
                                            {likely.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </div>
                                    </div>

                                    {/* Req Info */}
                                    <div className="grow">
                                        <h6 className="mb-0 text-base font-bold" style={{ color: '#F8FAFC' }}>{req.reqTitle}</h6>
                                        <div className="text-muted-foreground text-sm flex gap-2 mt-1">
                                            <span>{req.function}</span>
                                            <span>•</span>
                                            <span>{req.level}</span>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-500/15 text-slate-400 ml-2">{forecast.currentBucket}</span>
                                        </div>
                                    </div>

                                    {/* Confidence Visual - only show if we have date range */}
                                    {forecast.earliestDate && forecast.lateDate && (
                                        <div className="hidden md:block ml-4 text-right" style={{ minWidth: '200px' }}>
                                            <div className="text-sm text-muted-foreground mb-1" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confidence Window</div>
                                            <div className="flex items-center justify-end gap-2">
                                                <span className="text-sm font-medium text-slate-700">{new Date(forecast.earliestDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                                <div className="rounded-full" style={{
                                                    height: '6px',
                                                    width: '80px',
                                                    background: 'linear-gradient(90deg, var(--color-slate-300) 0%, var(--color-accent) 50%, var(--color-slate-300) 100%)',
                                                    opacity: 0.8
                                                }}></div>
                                                <span className="text-sm font-medium text-slate-700">{new Date(forecast.lateDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="mt-4 p-3 rounded border border-blue-500/25 bg-blue-500/10 text-blue-400 text-sm">
                <strong className="font-semibold">💡 Pro Tip:</strong> Predictions are based on historical stage velocity and current pipeline depth. Adding more candidates to late-stage buckets improves forecast accuracy.
            </div>
        </div>
    );
}
