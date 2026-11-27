import type { ApprovalChainInfo, ReviewSlaInfo } from '@/modules/reviews/api'

interface ApprovalChainStepperProps {
  chain: ApprovalChainInfo
  sla?: ReviewSlaInfo | null
  compact?: boolean
}

export function ApprovalChainStepper({
  chain,
  sla,
  compact = false,
}: ApprovalChainStepperProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? '0.4rem' : '0.6rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '0.73rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--muted)',
            }}
          >
            Approval Chain ({chain.completed_steps}/{chain.total_steps})
          </span>
          <span className="badge" style={{ fontSize: '0.7rem' }}>
            {chain.chain_source}
          </span>
          {chain.is_approval_satisfied && (
            <span className="badge badge-approved" style={{ fontSize: '0.7rem' }}>
              All Steps Approved
            </span>
          )}
        </div>

        {sla && sla.submitted_for_review_at && (
          <span
            className={sla.is_review_overdue ? 'badge badge-critical' : 'badge badge-medium'}
            style={{ fontSize: '0.71rem' }}
            title={`Submitted at ${new Date(sla.submitted_for_review_at).toLocaleString()}`}
          >
            {sla.is_review_overdue
              ? `SLA Escalation: ${sla.hours_awaiting_review.toFixed(1)}h / ${sla.escalation_threshold_hours}h`
              : `In Review: ${sla.hours_awaiting_review.toFixed(1)}h (SLA ${sla.escalation_threshold_hours}h)`}
          </span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.45rem',
        }}
      >
        {chain.steps.map((step, idx) => {
          const isApproved = step.status === 'Approved'
          const isPending = step.status === 'Pending'
          const borderColor = isApproved
            ? '#a7f3d0'
            : isPending
              ? '#bfdbfe'
              : 'var(--line)'
          const bgColor = isApproved ? '#ecfdf5' : isPending ? '#eff6ff' : '#f8fafc'
          const titleColor = isApproved
            ? '#065f46'
            : isPending
              ? '#1e40af'
              : '#475569'

          return (
            <div
              key={`${step.step_number}-${step.role}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}
            >
              <div
                style={{
                  border: `1px solid ${borderColor}`,
                  background: bgColor,
                  borderRadius: '0.48rem',
                  padding: compact ? '0.32rem 0.6rem' : '0.45rem 0.75rem',
                  minWidth: compact ? '130px' : '155px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.4rem',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: titleColor,
                  }}
                >
                  <span>
                    {isApproved ? '✓ ' : isPending ? '⏳ ' : '○ '}
                    Step {step.step_number}: {step.role}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '0.77rem',
                    color: 'var(--ink)',
                    fontWeight: 500,
                    marginTop: '0.12rem',
                  }}
                >
                  {step.user_name}
                </div>
                {!compact && step.approved_at && (
                  <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>
                    Round #{step.review_round} · {new Date(step.approved_at).toLocaleDateString()}
                  </div>
                )}
              </div>
              {idx < chain.steps.length - 1 && (
                <span style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: 600 }}>
                  →
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
