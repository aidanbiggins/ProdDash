import React, { useMemo } from 'react';
import { HMReqRollup } from '../../types/hmTypes';
import { SectionHeader } from '../common/SectionHeader';

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
            <div className="card-bespoke p-5 text-center text-muted">
                <div className="mb-3" style={{ fontSize: '3rem' }}>📅</div>
                <h5>Insufficient Data for Forecasting</h5>
                <p>Add active candidates to your requisitions to generate fill date predictions.</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            {/* Quick Stats */}
            <div className="row g-4 mb-4">
                <div className="col-md-6">
                    <div className="card-bespoke h-100">
                        <div className="card-body">
                            <div className="d-flex align-items-center mb-3">
                                <div className="rounded-circle bg-accent-soft d-flex align-items-center justify-content-center me-3" style={{ width: '48px', height: '48px', color: 'var(--color-accent)' }}>
                                    <i className="bi bi-bullseye fs-4"></i>
                                </div>
                                <div>
                                    <div className="stat-label">Total Expected Hires</div>
                                    <div className="stat-value">{stats.totalForecasted}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-md-6">
                    <div className="card-bespoke h-100">
                        <div className="card-body">
                            <div className="d-flex align-items-center mb-3">
                                <div className="rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: '48px', height: '48px', background: 'rgba(212, 163, 115, 0.15)', color: '#f59e0b' }}>
                                    <i className="bi bi-rocket-takeoff fs-4"></i>
                                </div>
                                <div>
                                    <div className="stat-label">Expected in Next 30 Days</div>
                                    <div className="stat-value text-primary">{stats.next30Days}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Timeline List */}
            <div className="card-bespoke mb-4">
                <div className="card-header bg-transparent border-0 pt-4 px-4 pb-0">
                    <SectionHeader
                        title="Upcoming Hiring Timeline"
                        subtitle="Projected fill dates based on current pipeline velocity"
                    />
                </div>
                <div className="card-body p-4">
                    <div className="timeline-container d-flex flex-column gap-3">
                        {forecastedReqs.map(req => {
                            const forecast = req.forecast!;
                            const likely = new Date(forecast.likelyDate!);
                            const daysUntil = Math.ceil((likely.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                            const isLate = daysUntil < 0;

                            return (
                                <div key={req.reqId} className="d-flex align-items-center p-3 rounded" style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-slate-200)' }}>
                                    {/* Date Badge */}
                                    <div className="me-4 text-center" style={{ minWidth: '80px' }}>
                                        <div className={`badge ${isLate ? 'badge-danger-soft' : 'badge-primary-soft'} mb-1`} style={{ fontSize: '0.9rem', padding: '0.5em 1em' }}>
                                            {isLate ? (
                                                <span>Overdue</span>
                                            ) : (
                                                <span>{daysUntil} Days</span>
                                            )}
                                        </div>
                                        <div className="small fw-bold text-muted text-uppercase" style={{ letterSpacing: '0.05em', fontSize: '0.7rem' }}>
                                            {likely.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </div>
                                    </div>

                                    {/* Req Info */}
                                    <div className="flex-grow-1">
                                        <h6 className="mb-0 fw-bold" style={{ color: '#F8FAFC' }}>{req.reqTitle}</h6>
                                        <div className="text-muted small d-flex gap-2 mt-1">
                                            <span>{req.function}</span>
                                            <span>•</span>
                                            <span>{req.level}</span>
                                            <span className="badge badge-neutral-soft ms-2" style={{ fontSize: '0.65rem' }}>{forecast.currentBucket}</span>
                                        </div>
                                    </div>

                                    {/* Confidence Visual - only show if we have date range */}
                                    {forecast.earliestDate && forecast.lateDate && (
                                        <div className="d-none d-md-block ms-4 text-end" style={{ minWidth: '200px' }}>
                                            <div className="small text-muted mb-1" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confidence Window</div>
                                            <div className="d-flex align-items-center justify-content-end gap-2">
                                                <span className="small fw-medium text-slate-700">{new Date(forecast.earliestDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                                <div className="rounded-pill" style={{
                                                    height: '6px',
                                                    width: '80px',
                                                    background: 'linear-gradient(90deg, var(--color-slate-300) 0%, var(--color-accent) 50%, var(--color-slate-300) 100%)',
                                                    opacity: 0.8
                                                }}></div>
                                                <span className="small fw-medium text-slate-700">{new Date(forecast.lateDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="mt-4 p-3 rounded border border-info border-opacity-25 bg-info bg-opacity-10 text-info-emphasis small">
                <strong>💡 Pro Tip:</strong> Predictions are based on historical stage velocity and current pipeline depth. Adding more candidates to late-stage buckets improves forecast accuracy.
            </div>
        </div>
    );
}
