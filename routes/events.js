const express = require('express');
const router = express.Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatEventbrite(ev) {
  const venue = ev.venue;
  const isOnline = ev.online_event;
  return {
    id: 'eb_' + ev.id,
    title: ev.name?.text || 'Untitled Event',
    cat: detectCategory(ev.name?.text + ' ' + (ev.description?.text || '')),
    mode: isOnline ? 'Online' : 'Offline',
    emoji: pickEmoji(ev.name?.text || ''),
    date: ev.start?.local
      ? new Date(ev.start.local).toLocaleString('en-IN', {
          dateStyle: 'medium', timeStyle: 'short'
        })
      : 'TBA',
    location: isOnline
      ? 'Online Event'
      : venue
        ? `${venue.name || ''}, ${venue.city || ''}, ${venue.country || ''}`.replace(/^,\s*|,\s*$/g, '')
        : 'Location TBA',
    price: ev.is_free ? 'Free' : ev.ticket_availability?.minimum_ticket_price
      ? ev.ticket_availability.minimum_ticket_price.display
      : 'Paid',
    desc: ev.description?.text?.slice(0, 200) || 'No description available.',
    url: ev.url,
    source: 'Eventbrite',
    image: ev.logo?.url || null,
    lat: venue?.latitude || null,
    lng: venue?.longitude || null,
  };
}

function formatTicketmaster(ev) {
  const venue = ev._embedded?.venues?.[0];
  const priceRange = ev.priceRanges?.[0];
  return {
    id: 'tm_' + ev.id,
    title: ev.name,
    cat: detectCategory(ev.name + ' ' + (ev.classifications?.[0]?.segment?.name || '')),
    mode: 'Offline',
    emoji: pickEmoji(ev.name),
    date: ev.dates?.start?.localDate
      ? new Date(ev.dates.start.localDate).toLocaleString('en-IN', { dateStyle: 'medium' }) +
        (ev.dates.start.localTime ? ' · ' + ev.dates.start.localTime.slice(0,5) : '')
      : 'TBA',
    location: venue
      ? `${venue.name || ''}, ${venue.city?.name || ''}, ${venue.country?.name || ''}`.replace(/^,\s*|,\s*$/g, '')
      : 'Location TBA',
    price: priceRange
      ? `${priceRange.currency} ${priceRange.min}`
      : 'Check site',
    desc: ev.info || ev.pleaseNote || 'See Ticketmaster for full details.',
    url: ev.url,
    source: 'Ticketmaster',
    image: ev.images?.[0]?.url || null,
    lat: venue?.location?.latitude || null,
    lng: venue?.location?.longitude || null,
  };
}

function detectCategory(text) {
  text = (text || '').toLowerCase();
  if (/tech|ai|software|coding|developer|web|data|cloud|cyber/.test(text)) return 'Tech';
  if (/music|concert|band|dj|festival|live/.test(text)) return 'Music';
  if (/health|yoga|wellness|fitness|meditat|mental/.test(text)) return 'Health';
  if (/art|design|paint|exhibit|gallery|creative/.test(text)) return 'Art';
  if (/business|startup|entrepreneur|invest|finance|marketing/.test(text)) return 'Business';
  if (/educat|seminar|workshop|training|learn|course/.test(text)) return 'Education';
  return 'Other';
}

function pickEmoji(title) {
  title = (title || '').toLowerCase();
  if (/tech|ai|code|software/.test(title)) return '💻';
  if (/music|concert|festival/.test(title)) return '🎵';
  if (/yoga|health|wellness/.test(title)) return '🧘';
  if (/art|paint|design/.test(title)) return '🎨';
  if (/business|startup/.test(title)) return '🚀';
  if (/food|cook/.test(title)) return '🍕';
  if (/sport|run|marathon/.test(title)) return '🏃';
  return '📅';
}

// ─── Eventbrite Fetch ────────────────────────────────────────────────────────

async function fetchEventbrite({ query, location, page = 1 }) {
  const token = process.env.EVENTBRITE_TOKEN;
  if (!token) return [];

  const params = new URLSearchParams({
    'q': query || '',
    'location.address': location || '',
    'location.within': '50km',
    'expand': 'venue,ticket_availability,logo',
    'page': page,
    'page_size': 12,
    'sort_by': 'date',
  });

  if (!location) {
    // No location = worldwide popular events
    params.delete('location.address');
    params.delete('location.within');
  }

  try {
    const res = await fetch(
      `https://www.eventbriteapi.com/v3/events/search/?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!data.events) return [];
    return data.events.map(formatEventbrite);
  } catch (e) {
    console.error('Eventbrite error:', e.message);
    return [];
  }
}

// ─── Ticketmaster Fetch ──────────────────────────────────────────────────────

async function fetchTicketmaster({ query, location }) {
  const key = process.env.TICKETMASTER_KEY;
  if (!key) return [];

  const params = new URLSearchParams({
    apikey: key,
    keyword: query || '',
    city: location || '',
    size: 12,
    sort: 'date,asc',
  });

  if (!location) params.delete('city');

  try {
    const res = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?${params}`
    );
    const data = await res.json();
    const events = data._embedded?.events || [];
    return events.map(formatTicketmaster);
  } catch (e) {
    console.error('Ticketmaster error:', e.message);
    return [];
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/events?query=tech&location=Mumbai&source=all
router.get('/', async (req, res) => {
  const { query = '', location = '', source = 'all', page = 1 } = req.query;

  try {
    let results = [];

    if (source === 'eventbrite' || source === 'all') {
      const eb = await fetchEventbrite({ query, location, page });
      results.push(...eb);
    }

    if (source === 'ticketmaster' || source === 'all') {
      const tm = await fetchTicketmaster({ query, location });
      results.push(...tm);
    }

    // Sort by date
    results.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      success: true,
      count: results.length,
      query,
      location,
      events: results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// GET /api/events/categories - get available categories
router.get('/categories', (req, res) => {
  res.json({
    success: true,
    categories: ['All', 'Tech', 'Music', 'Health', 'Art', 'Business', 'Education', 'Other']
  });
});

module.exports = router;
