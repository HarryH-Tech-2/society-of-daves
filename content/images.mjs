// Photos used in blog posts, with the credit each licence requires.
// Use one in a post body with <!-- figure:KEY -->. Files live in
// public/images/blog/ and come from Wikimedia Commons.

const CC = {
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
  'CC BY-SA 2.0': 'https://creativecommons.org/licenses/by-sa/2.0/',
  'CC BY 2.0': 'https://creativecommons.org/licenses/by/2.0/',
};

const img = (src, width, height, alt, caption, { artist, license, page }, portrait = false) => ({
  src: `/images/blog/${src}`, width, height, alt, caption, artist, license, licenseUrl: CC[license] || null, page, portrait,
});

export const images = {
  kingDavid: img('king-david-honthorst.jpg', 960, 1199,
    'Painting of King David, an old bearded man in a fur-trimmed robe, playing a gold harp',
    'King David Playing the Harp by Gerard van Honthorst, 1622. The original Dave, as a musician.',
    { artist: 'Gerard van Honthorst', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Gerard_van_Honthorst_-_King_David_Playing_the_Harp_-_Google_Art_Project.jpg' }, true),

  michelangelo: img('michelangelo-david.jpg', 960, 1537,
    "Michelangelo's marble statue of David, standing with a sling over his shoulder",
    "Michelangelo's David in the Galleria dell'Accademia, Florence. Carved 1501 to 1504, and 5.17 metres tall.",
    { artist: 'Livioandronico2013', license: 'CC BY-SA 4.0', page: "https://commons.wikimedia.org/wiki/File:Michelangelo%27s_David_2015.jpg" }, true),

  cathedral: img('st-davids-cathedral.jpg', 1280, 853,
    'St Davids Cathedral, a long stone church with a square tower, in a green valley',
    "St Davids Cathedral in Pembrokeshire, on the site of Saint David's monastery.",
    { artist: 'The late Dr P Clements', license: 'CC BY-SA 2.0', page: 'https://commons.wikimedia.org/wiki/File:St_David%27s_Cathedral,_Pembrokeshire_-_geograph.org.uk_-_6441710.jpg' }),

  daffodils: img('wild-daffodils.jpg', 1280, 719,
    'Wild daffodils flowering in grass',
    'Wild daffodils. They flower around 1 March, just in time for St David\'s Day.',
    { artist: 'Jonathan Billinger', license: 'CC BY-SA 2.0', page: 'https://commons.wikimedia.org/wiki/File:Wild_daffodils,_Narcissus_pseudonarcissus_-_geograph.org.uk_-_5310808.jpg' }),

  welshCakes: img('welsh-cakes.jpg', 1280, 960,
    'A plate of round, sugar-dusted Welsh cakes',
    'Welsh cakes: cooked on a griddle, eaten all year, and especially on St David\'s Day.',
    { artist: 'Moochocoogle at English Wikipedia', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Welsh_cakes2.jpg' }),

  turntable: img('turntable.jpg', 1280, 853,
    'A record player playing a coloured vinyl record',
    'Every music Dave needs something to play the Bowie records on.',
    { artist: 'M. Johnson', license: 'CC BY 2.0', page: 'https://commons.wikimedia.org/wiki/File:Audio-Technica_turntable_playing_coloured_vinyl.jpg' }),

  davidBuilder: img('david-the-builder.jpg', 774, 1200,
    'Medieval fresco of King David IV of Georgia, holding a model of a church',
    'King David IV of Georgia, "the Builder", in a fresco at Gelati Monastery. In Georgian, David is Davit.',
    { artist: 'Unknown fresco artist; photographed by the National Archives of Georgia', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:King_David_IV_the_Builder._Gelati_fresco.jpg' }, true),
};
