import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fundPage, getPage } from '../lib/api'
import { resolveTokenFromInput } from '../../shared/emoji-token'
import { formatExpiryDate, formatPageValidUntil } from '../lib/expiry'
import { fetchMintLabel, formatMintTitleName, formatMintHostname } from '../lib/mint-label'
import { CashuProtocolBanner } from '../components/CashuProtocolBanner'
import { scrollSectionToTop } from '../lib/scroll-section'
import { SHOP_OPTIONS } from '../lib/spend-options'
import { CashuClaimHero } from '../components/CashuClaimHero'
import { CollectionHero } from '../components/CollectionHero'
import { MergeCollectionButton } from '../components/MergeCollectionButton'
import { CashuTokenInput, type CashuTokenInputHandle } from '../components/CashuTokenInput'
import { Collapsible } from '../components/Collapsible'
import { TokenCompositionPanel } from '../components/TokenCompositionPanel'
import { PartialBalanceNote } from '../components/PartialBalanceNote'
import {
  InfoIcon,
  PanelTitle,
  SpendPanelIcon,
  ExchangePanelIcon,
} from '../components/PanelIcons'
import { SpendLinks } from '../components/SpendLinks'
import { ExchangeLinks } from '../components/ExchangeLinks'
import { WalletResources } from '../components/WalletResources'
import type { GiftPage } from '../../shared/types'

const RedeemToLightning = lazy(() =>
  import('../components/RedeemToLightning').then((m) => ({
    default: m.RedeemToLightning,
  })),
)

type AccordionSection = 'cashu' | 'composition' | 'redeem' | 'shops' | 'exchange'

export function GiftPageView() {
  const { id = '' } = useParams()

  const [page, setPage] = useState<GiftPage | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [funding, setFunding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fundError, setFundError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'emoji' | 'token' | null>(null)
  const [copiedCollectionIndex, setCopiedCollectionIndex] = useState<number | null>(null)
  const [copiedCollectionEmojiIndex, setCopiedCollectionEmojiIndex] = useState<number | null>(null)
  const [showLoadedBanner, setShowLoadedBanner] = useState(false)
  const [openSection, setOpenSection] = useState<AccordionSection | null>('cashu')
  const [mintLabel, setMintLabel] = useState<string | null>(null)
  const sectionRefs = useRef<Partial<Record<AccordionSection, HTMLElement | null>>>({})
  const skipScrollOnMount = useRef(true)
  const fundAttempt = useRef(0)
  const tokenInputRef = useRef<CashuTokenInputHandle>(null)

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

  useEffect(() => {
    if (openSection !== 'cashu') {
      void tokenInputRef.current?.stopScanning()
    }
  }, [openSection])

  const scrollIfRedeemOpen = useCallback(() => {
    if (openSection === 'redeem') {
      scrollSectionToTop(sectionRefs.current.redeem)
    }
  }, [openSection])

  const mintUrl = useMemo(
    () => page?.mint ?? page?.tokens[0]?.mint ?? null,
    [page?.mint, page?.tokens],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getPage(id)
      .then((data) => {
        if (cancelled) return
        setPage(data)
        if (!data.claimed && !data.expired) {
          setOpenSection('cashu')
        }
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
    if (!page || page.funded || page.claimed || page.expired) return

    const token = resolveTokenFromInput(tokenInput)
    if (!token) return

    const attempt = ++fundAttempt.current
    setFunding(true)
    setFundError(null)

    fundPage(id, { token })
      .then((updated) => {
        if (attempt !== fundAttempt.current) return
        setPage(updated)
        setTokenInput('')
        setOpenSection('cashu')
        setShowLoadedBanner(true)
      })
      .catch((err) => {
        if (attempt !== fundAttempt.current) return
        setTokenInput('')
        setFundError(err instanceof Error ? err.message : 'Could not attach token')
      })
      .finally(() => {
        if (attempt === fundAttempt.current) setFunding(false)
      })
  }, [tokenInput, id, page])

  useEffect(() => {
    if (!showLoadedBanner) return
    const timer = window.setTimeout(() => setShowLoadedBanner(false), 30_000)
    return () => window.clearTimeout(timer)
  }, [showLoadedBanner])

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

  async function copyCollectionToken(text: string, index: number) {
    await navigator.clipboard.writeText(text)
    setCopiedCollectionIndex(index)
    setCopiedCollectionEmojiIndex(null)
    setTimeout(() => setCopiedCollectionIndex(null), 2000)
  }

  async function copyCollectionEmoji(text: string, index: number) {
    await navigator.clipboard.writeText(text)
    setCopiedCollectionEmojiIndex(index)
    setCopiedCollectionIndex(null)
    setTimeout(() => setCopiedCollectionEmojiIndex(null), 2000)
  }

  async function copy(text: string, kind: 'emoji' | 'token') {
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

  const expiryDate = formatExpiryDate(page.expiresAt)
  const validUntilLabel = formatPageValidUntil(page.expiresAt)
  const tokenVersionKey = page.tokens
    .map((t) => `${t.addedAt}:${t.amountSats}`)
    .join('|')
  const mintTitleName = mintLabel ? formatMintTitleName(mintLabel) : null
  const isCollection = page.kind === 'collection'
  const showGiftPanels = page.funded && !isCollection

  const heroTitle = (
    <PanelTitle>
      Your <span className="btc-mark">₿</span>{' '}
      {mintTitleName ? (
        <>
          custodied by <span className="mint-mark">{mintTitleName}</span>
        </>
      ) : (
        'custodied by …'
      )}
    </PanelTitle>
  )

  return (
    <div className="gift-layout">
      <CashuProtocolBanner />
      {page.claimed ? (
        <section className="panel terminal-state claimed-state">
          <h1>Already claimed</h1>
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
      ) : (
        <div className="gift-layout">
          {page.funded && showLoadedBanner && (
            <p className="funded-loaded-banner" role="status">
              Loaded
            </p>
          )}
          {!page.funded ? (
            <section
              className="load-token-section"
              ref={bindSectionRef('cashu')}
              aria-label="Load Cashu token"
            >
              <h1 className="load-token-title">Load your Cashu token</h1>
              <div className="load-token-guide claim-hero-info-panel">
                <p className="load-token-guide-lede">
                  Display it on a webpage whose URL effectively serves as the password:
                  long, random, and virtually impossible to guess.
                </p>
              </div>
              {funding ? (
                <p className="status">Publishing your gift…</p>
              ) : (
                <>
                  <CashuTokenInput
                    ref={tokenInputRef}
                    value={tokenInput}
                    onChange={setTokenInput}
                  />
                  {fundError && <p className="error">{fundError}</p>}
                </>
              )}
            </section>
          ) : (
            <>
              <Collapsible
                title={heroTitle}
                open={openSection === 'cashu'}
                onToggle={() => toggleSection('cashu')}
                rootRef={bindSectionRef('cashu')}
              >
                {isCollection ? (
                  <CollectionHero
                    key={tokenVersionKey}
                    page={page}
                    onCopyToken={copyCollectionToken}
                    onCopyEmoji={copyCollectionEmoji}
                    copiedTokenIndex={copiedCollectionIndex}
                    copiedEmojiIndex={copiedCollectionEmojiIndex}
                    onCollectionUpdated={setPage}
                  />
                ) : (
                  <CashuClaimHero
                    key={tokenVersionKey}
                    page={page}
                    onCopyToken={(token) => copy(token, 'token')}
                    onCopyEmoji={(emoji) => copy(emoji, 'emoji')}
                    copiedToken={copied === 'token'}
                    copiedEmoji={copied === 'emoji'}
                  />
                )}
              </Collapsible>

              {showGiftPanels && (
                <Collapsible
                  title={
                    <PanelTitle>
                      <InfoIcon className="panel-icon" />
                      Token composition
                    </PanelTitle>
                  }
                  open={openSection === 'composition'}
                  onToggle={() => toggleSection('composition')}
                  rootRef={bindSectionRef('composition')}
                >
                  <TokenCompositionPanel
                    key={tokenVersionKey}
                    page={page}
                    onPageUpdated={setPage}
                  />
                </Collapsible>
              )}
            </>
          )}

          {showGiftPanels && (
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
          )}

          {showGiftPanels && (
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
              <PartialBalanceNote partiallySpent={page.partiallySpent} />
              <SpendLinks options={SHOP_OPTIONS} />
            </Collapsible>
          )}

          {showGiftPanels && (
            <Collapsible
              title={
                <PanelTitle>
                  <ExchangePanelIcon />
                  Exchange
                </PanelTitle>
              }
              open={openSection === 'exchange'}
              onToggle={() => toggleSection('exchange')}
              rootRef={bindSectionRef('exchange')}
            >
              <ExchangeLinks />
            </Collapsible>
          )}

          {isCollection && page.tokens.length >= 2 && (
            <MergeCollectionButton
              pageId={id}
              onMerged={(updated) => {
                setPage(updated)
                setOpenSection('cashu')
              }}
            />
          )}

          <WalletResources />

          {page.funded && page.expiresAt && (
            <div className={`expiry-footer ${page.expired ? 'expired' : ''}`}>
              {page.expired ? (
                <>
                  <strong>This gift page expired</strong>
                  {expiryDate && <span> on {expiryDate}</span>}
                </>
              ) : (
                validUntilLabel && <span>{validUntilLabel}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
