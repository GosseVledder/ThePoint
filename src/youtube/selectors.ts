// All YouTube DOM selectors live here. Verified against youtube.com on 2026-10-04.
// When YouTube changes its markup, this is the only file that should need updating.

export const SEL = {
  // Watch page layout
  watchFlexy: 'ytd-watch-flexy',
  /** Right column above the recommendations (two-column layout). */
  secondaryInner: 'ytd-watch-flexy #secondary-inner',
  secondary: 'ytd-watch-flexy #secondary',
  /** Under the player (single-column layout). */
  below: 'ytd-watch-flexy #below',
  watchMetadata: 'ytd-watch-flexy #below ytd-watch-metadata',
  watchTitle: 'ytd-watch-metadata #title h1, ytd-watch-metadata h1',
  watchChannel: 'ytd-watch-metadata ytd-channel-name a, ytd-watch-metadata #owner #channel-name a',
  /** Attribute on ytd-watch-flexy when the page uses two columns. */
  twoColumnsAttr: 'is-two-columns_',
  fullscreenAttr: 'fullscreen',
  theaterAttr: 'theater',

  // Player
  player: '#movie_player',
  video: '#movie_player video.html5-main-video, #movie_player video',
  progressBar: '#movie_player .ytp-progress-bar',
  rightControls: '#movie_player .ytp-right-controls',
  /** Player overlay layer used for in-player UI in fullscreen. */
  playerOverlayParent: '#movie_player',

  // Theme: YouTube sets `dark` on <html> in dark mode.
  darkThemeAttr: 'dark',

  // Description and transcript panel (strategy 2)
  descriptionExpand:
    'ytd-watch-metadata #description-inline-expander #expand, ytd-watch-metadata #expand',
  transcriptButton: 'ytd-video-description-transcript-section-renderer button',
  engagementPanel: 'ytd-engagement-panel-section-list-renderer',
  engagementPanelExpanded:
    'ytd-engagement-panel-section-list-renderer[visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]',
  engagementPanelClose:
    '#visibility-button button, ytd-engagement-panel-title-header-renderer #visibility-button button',
  /** New transcript segment component (2025+). */
  transcriptSegmentNew: 'transcript-segment-view-model',
  transcriptSegmentNewTime: '.ytwTranscriptSegmentViewModelTimestamp',
  transcriptSegmentNewText: 'span.ytAttributedStringHost, span[role="text"]',
  /** Legacy transcript segment component. */
  transcriptSegmentOld: 'ytd-transcript-segment-renderer',
  transcriptSegmentOldTime: '.segment-timestamp',
  transcriptSegmentOldText: '.segment-text',

  // Thumbnails (home, search, sidebar). Shorts links (/shorts/) never match.
  /**
   * Anchor that wraps a video thumbnail:
   * - classic renderers (search): a#thumbnail inside ytd-thumbnail
   * - lockup view model (home, sidebar): an anchor containing yt-thumbnail-view-model
   */
  thumbnailAnchor:
    'a#thumbnail[href*="/watch?v="], a[href*="/watch?v="]:has(> yt-thumbnail-view-model), a[href*="/watch?v="]:has(yt-thumbnail-view-model)',
  /** Areas that contain thumbnails we decorate. */
  thumbnailScope: 'ytd-browse, ytd-search, ytd-watch-flexy #secondary, ytd-watch-flexy #related',
} as const;

export const EVENTS = {
  /** Fired by YouTube after every SPA navigation. */
  navigateFinish: 'yt-navigate-finish',
  navigateStart: 'yt-navigate-start',
  /** Fired when the player's data for a new video is ready. */
  pageDataUpdated: 'yt-page-data-updated',
} as const;
