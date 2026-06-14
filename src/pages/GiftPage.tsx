import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fundPage, getPage, updatePageContact } from '../lib/api'
import { formatDaysRemaining, formatExpiryDate, useDaysRemaining } from '../lib/expiry'
import { fetchMintLabel, formatMintTitleName, formatMintHostname } from '../lib/mint-label'
import { CashuProtocolBanner } from '../components/CashuProtocolBanner'
import { scrollSectionToTop } from '../lib/scroll-section'
import { SHOP_OPTIONS } from '../lib/spend-options'
import { CLAIMED_PAGE_TTL_MS } from '../../shared/types'
import { CashuClaimHero } from '../components/CashuClaimHero'
import { CashuTokenInput } from '../components/CashuTokenInput'
import { Collapsible } from '../components/Collapsible'
import { NotifyFields } from '../components/NotifyFields'
import { PartialBalanceNote } from '../components/PartialBalanceNote'
import {
  NotifyPanelIcon,
  PanelTitle,
  SpendPanelIcon,
} from '../components/PanelIcons'
import { SharePanel } from '../components/SharePanel'
import { SpendLinks } from '../components/SpendLinks'
import { WalletResources } from '../components/WalletResources'
import type { GiftPage } from '../../shared/types'

const RedeemToLightning = lazy(() =>
  import('../components/RedeemToLightning').then((m) => ({
    default: m.RedeemToLightning,
  })),
)

type AccordionSection = 'cashu' | 'share' | 'redeem' | 'shops' | 'contact'

export function GiftPageView() {
  const { id = '' } = useParams()
  const [page, setPage] = useState<GiftPage | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [funding, setFunding] = useState(false)
  const [savingContact, setSavingContact] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contactMsg, setContactMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState<'link' | 'emoji' | 'token' | null>(null)
  const [openSection, setOpenSection] = useState<AccordionSection | null>('cashu')
  const [mintLabel, setMintLabel] = useState<string | null>(null)
  const sectionRefs = useRef<Partial<Record<AccordionSection, HTMLElement | null>>>({})
  const skipScrollOnMount = useRef(true)

  const bindSectionRef = useCallback(
    (section: AccordionSection) => (node: HTMLElement | null) => {
      sectionRefs.current[section] = node
    },
    [],
  )

  useEffect(() => {
    if (skipScrollOnMount.current) {
      skipScrollOnMount.current = false
      return
    }
    if (!openSection) return
    scrollSectionToTop(sectionRefs.current[openSection])
  }, [openSection])

  const scrollIfRedeemOpen = useCallback(() => {
    if (openSection === 'redeem') {
      scrollSectionToTop(sectionRefs.current.redeem)
    }
  }, [openSection])

  const pageUrl = useMemo(() => `${window.location.origin}/g/${id}`, [id])
  const mintUrl = useMemo(
    () => page?.mint ?? page?.tokens[0]?.mint ?? null,
    [page?.mint, page?.tokens],
  )
  const daysLeft = useDaysRemaining(page?.expiresAt ?? null)
  const claimedRemoveAt = useMemo(
    () =>
      page?.claimedAt != null ? page.claimedAt + CLAIMED_PAGE_TTL_MS : null,
    [page?.claimedAt],
  )
  const claimedDaysLeft = useDaysRemaining(claimedRemoveAt)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getPage(id)
      .then((data) => {
        if (cancelled) return
        setPage(data)
        setEmail(data.recipientEmail ?? '')
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Page not found')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!mintUrl) {
      setMintLabel(null)
      return
    }

    let cancelled = false
    setMintLabel(formatMintHostname(mintUrl))

    fetchMintLabel(mintUrl)
      .then((label) => {
        if (!cancelled) setMintLabel(label)
      })
      .catch(() => {
        if (!cancelled) setMintLabel(formatMintHostname(mintUrl))
      })

    return () => {
      cancelled = true
    }
  }, [mintUrl])

  async function handleFund(e: React.FormEvent) {
    e.preventDefault()
    setFunding(true)
    setError(null)
    try {
      const updated = await fundPage(id, {
        token: tokenInput.trim(),
      })
      setPage(updated)
      setTokenInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not attach token')
    } finally {
      setFunding(false)
    }
  }

  async function saveContactSilently() {
    const updated = await updatePageContact(id, {
      recipientEmail: email.trim() || null,
    })
    setPage(updated)
  }

  async function handleSaveContact(e: React.FormEvent) {
    e.preventDefault()
    setSavingContact(true)
    setContactMsg(null)
    setError(null)
    try {
      await saveContactSilently()
      setContactMsg('Saved (notifications coming soon).')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save contact')
    } finally {
      setSavingContact(false)
    }
  }

  async function copy(text: string, kind: 'link' | 'emoji' | 'token') {
    await navigator.clipboard.writeText(text)
    setCopied(kind)
    setTimeout(() => setCopied(null), 2000)
  }

  function toggleSection(section: AccordionSection) {
    setOpenSection((current) => (current === section ? null : section))
  }

  if (loading) {
    return <p className="status">Loading gift page…</p>
  }

  if (error && !page) {
    return (
      <section className="panel">
        <h1>Page not found</h1>
        <p className="error">{error}</p>
        <Link to="/" className="link-button">
          Create a new page
        </Link>
      </section>
    )
  }

  if (!page) return null

  const daysLabel = formatDaysRemaining(daysLeft)
  const expiryDate = formatExpiryDate(page.expiresAt)
  const tokenVersionKey = page.tokens
    .map((t) => `${t.addedAt}:${t.amountSats}`)
    .join('|')
  const mintTitleName = mintLabel ? formatMintTitleName(mintLabel) : null

  return (
    <div className="gift-layout">
      <CashuProtocolBanner />
      {page.claimed ? (
        <section className="panel terminal-state claimed-state">
          <p className="eyebrow">Gift</p>
          <h1>Already claimed</h1>
          <p className="lede">
            This Cashu gift was redeemed. The ecash is no longer available on
            this page.
          </p>
          {page.amountSats != null && (
            <p className="claimed-amount">
              {page.amountSats.toLocaleString()} sats
            </p>
          )}
          {page.memo && <p className="memo">“{page.memo}”</p>}
          {page.claimedAt != null && (
            <p className="hint compact">
              Claimed on {formatExpiryDate(page.claimedAt)}
            </p>
          )}
          {claimedDaysLeft != null && claimedDaysLeft > 0 && (
            <p className="hint compact">
              This page will be removed in {formatDaysRemaining(claimedDaysLeft)}
            </p>
          )}
          <Link to="/" className="link-button primary terminal-cta">
            Open a new gift page
          </Link>
        </section>
      ) : page.expired ? (
        <section className="panel terminal-state">
          <h1>Gift no longer available</h1>
          <p className="lede">
            This page reached its one-year limit after it was funded.
            Ask the sender to create a fresh page if you still need a gift.
          </p>
          <Link to="/" className="link-button primary terminal-cta">
            Open a new gift page
          </Link>
        </section>
      ) : !page.funded ? (
        <section className="panel">
          <h1>Load your Cashu tokens</h1>

          <form onSubmit={handleFund} className="stack">
            <CashuTokenInput value={tokenInput} onChange={setTokenInput} />

            {error && <p className="error">{error}</p>}

            <button
              type="submit"
              className="primary"
              disabled={funding || !tokenInput.trim()}
            >
              {funding ? 'Publishing…' : 'Publish gift page'}
            </button>
          </form>
        </section>
      ) : (
        <>
          <div className="gift-layout">
          <Collapsible
            title={
              <PanelTitle>
                Your <span className="btc-mark">₿</span> in{' '}
                {mintTitleName ? (
                  <span className="mint-mark">{mintTitleName}</span>
                ) : (
                  '…'
                )}
              </PanelTitle>
            }
            open={openSection === 'cashu'}
            onToggle={() => toggleSection('cashu')}
            rootRef={bindSectionRef('cashu')}
          >
            <CashuClaimHero
              key={tokenVersionKey}
              page={page}
              onCopyToken={(token) => copy(token, 'token')}
              onCopyEmoji={(emoji) => copy(emoji, 'emoji')}
              copiedToken={copied === 'token'}
              copiedEmoji={copied === 'emoji'}
            />
          </Collapsible>

          <Collapsible
            title={
              <PanelTitle>
                Redeem to <span className="btc-mark">₿</span>{' '}
                <span className="lightning-mark" aria-hidden>
                  ⚡
                </span>
              </PanelTitle>
            }
            open={openSection === 'redeem'}
            onToggle={() => toggleSection('redeem')}
            rootRef={bindSectionRef('redeem')}
          >
            {page.tokens[0] && (
              <Suspense fallback={<p className="hint compact">Loading redeem…</p>}>
                <RedeemToLightning
                  key={tokenVersionKey}
                  pageId={id}
                  token={page.tokens[0].token}
                  giftBalanceSats={page.amountSats ?? page.tokens[0].amountSats}
                  onRedeemed={(updated) => setPage(updated)}
                  onReady={scrollIfRedeemOpen}
                />
              </Suspense>
            )}
          </Collapsible>

          <Collapsible
            title={
              <PanelTitle>
                <SpendPanelIcon />
                Shop
              </PanelTitle>
            }
            open={openSection === 'shops'}
            onToggle={() => toggleSection('shops')}
            rootRef={bindSectionRef('shops')}
          >
            <PartialBalanceNote />
            <SpendLinks options={SHOP_OPTIONS} />
          </Collapsible>

          <Collapsible
            title={
              <PanelTitle>
                <NotifyPanelIcon />
                Notify me
              </PanelTitle>
            }
            open={openSection === 'contact'}
            onToggle={() => toggleSection('contact')}
            rootRef={bindSectionRef('contact')}
          >
            <form onSubmit={handleSaveContact} className="stack">
              <NotifyFields
                email={email}
                onEmailChange={setEmail}
                disabled={savingContact}
              />
              {contactMsg && <p className="success">{contactMsg}</p>}
              <button type="submit" className="ghost" disabled={savingContact}>
                {savingContact ? 'Saving…' : 'Save'}
              </button>
            </form>
          </Collapsible>

          <SharePanel
            pageUrl={pageUrl}
            onCopyLink={() => copy(pageUrl, 'link')}
            linkCopied={copied === 'link'}
            open={openSection === 'share'}
            onToggle={() => toggleSection('share')}
            rootRef={bindSectionRef('share')}
          />

          {page.expiresAt && (
            <div className={`expiry-footer ${page.expired ? 'expired' : ''}`}>
              {page.expired ? (
                <>
                  <strong>This gift page expired</strong>
                  {expiryDate && <span> on {expiryDate}</span>}
                </>
              ) : (
                <>
                  <strong>{daysLabel}</strong>
                  {expiryDate && <span> · Valid until {expiryDate}</span>}
                </>
              )}
            </div>
          )}

          <WalletResources />
        </div>
        </>
      )}
    </div>
  )
}
