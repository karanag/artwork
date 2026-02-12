import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

const TAUPE = '#D8D2C8'
const DARK = '#2E2A26'
const MID = '#6A625A'
const LIGHT_BG = '#FFFFFF'
const POM_BG = '#F6F3EE'

const styles = StyleSheet.create({
  page: {
    backgroundColor: LIGHT_BG,
    color: DARK,
    fontFamily: 'Helvetica',
    fontSize: 9,
    padding: 32,
  },

  columns: {
    flexDirection: 'row',
  },

  leftColumn: {
    width: '62%',
    paddingRight: 26,
  },

  rightColumn: {
    width: '38%',
    justifyContent: 'space-between',
  },

  /* LEFT */

  cadFrame: {
    height: 500,
    justifyContent: 'center',
    alignItems: 'center',
  },

  cadImage: {
    maxHeight: '100%',
    objectFit: 'contain',
  },

  cadLabel: {
    marginTop: 12,
    fontSize: 8,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: MID,
  },

  /* RIGHT SECTIONS */

  sectionTitle: {
    fontSize: 8,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
    color: MID,
  },

  divider: {
    height: 0.5,
    backgroundColor: TAUPE,
    opacity: 0.35,
    marginVertical: 16,
  },

  /* SECTION 1 – HERO + META */

  topSection: {
    minHeight: 150,
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  heroWrap: {
    width: '55%',
    height: 125,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },

  heroImage: {
    height: '100%',
    objectFit: 'contain',
  },

  metaBlock: {
    width: '42%',
  },

  metaRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },

  metaKey: {
    width: '45%',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
  },

  metaValue: {
    width: '55%',
    fontSize: 8.5,
  },

  /* SECTION 2 – COLOUR GUIDE */

  swatchSection: {
    minHeight: 180,
  },

  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  swatchItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  swatchCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 0.4,
    borderColor: TAUPE,
    marginRight: 10,
  },

  swatchPomFrame: {
  width: 42,
  height: 42,
  backgroundColor: '#FFFFFF',
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 10,
},

  swatchThumb: {
    width: 36,
    height: 36,
    objectFit: 'contain',
  },

  swatchTextWrap: {
    flexDirection: 'column',
  },

  swatchCode: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.6,
  },

  swatchMaterial: {
    fontSize: 7,
    color: MID,
    marginTop: 2,
  },

  /* SECTION 3 – TEXTURES + NOTES */

  bottomSection: {
    minHeight: 150,
  },

  textureRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },

  textureItem: {
    marginRight: 14,
  },

  textureImage: {
    width: 60,
    height: 60,
    objectFit: 'cover',
  },

  notesText: {
    fontSize: 8,
    color: MID,
    lineHeight: 1.4,
  },

  footer: {
    marginTop: 18,
    fontSize: 8,
    textAlign: 'center',
    letterSpacing: 1.2,
    color: MID,
  },
})

function hasText(v) {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().toUpperCase() !== 'N/A'
}

function asText(v, fallback = '') {
  return hasText(v) ? v.trim() : fallback
}

function buildMetaRows(data) {
  const rows = []
  const meta = data?.meta || {}

  if (hasText(meta.projectRef)) rows.push(['Project Ref', meta.projectRef])
  if (hasText(meta.design)) rows.push(['Design No', meta.design])
  if (hasText(meta.quality)) rows.push(['Quality', meta.quality])
  if (hasText(meta.size)) rows.push(['Size', meta.size])
  if (hasText(meta.content)) rows.push(['Content', meta.content])
  if (hasText(meta.date)) rows.push(['Date', meta.date])

  return rows
}

export default function ArtworkPDF({ data }) {
  const heroImage = asText(data?.heroImage)
  const referenceMode = data?.referenceMode || 'visualisation'
  const metaRows = buildMetaRows(data)
  const colors = Array.isArray(data?.colors) ? data.colors : []
  const textures = Array.isArray(data?.textures) ? data.textures.slice(0, 3) : []
  const notes = asText(data?.meta?.notes)

  return (
    <Document title={`Artwork ${asText(data?.artworkReference, '')}`}>
      <Page size="A4" orientation="landscape" style={styles.page} wrap={false}>
        <View style={styles.columns}>

          {/* LEFT */}
          <View style={styles.leftColumn}>
            <View style={styles.cadFrame}>
              {hasText(data?.cadImage) && (
                <Image src={data.cadImage} style={styles.cadImage} />
              )}
            </View>
            <Text style={styles.cadLabel}>Final Artwork / CAD</Text>
          </View>

          {/* RIGHT */}
          <View style={styles.rightColumn}>

            {/* SECTION 1 */}
            <View style={styles.topSection}>
              {heroImage && (
                <>
                  <Text style={styles.sectionTitle}>
                    {referenceMode === 'inspiration'
                      ? 'Inspiration'
                      : 'Visualisation'}
                  </Text>

                  <View style={styles.topRow}>
                    <View style={styles.heroWrap}>
                      <Image src={heroImage} style={styles.heroImage} />
                    </View>

                    <View style={styles.metaBlock}>
                      {metaRows.map(([key, value]) => (
                        <View key={key} style={styles.metaRow}>
                          <Text style={styles.metaKey}>{key}</Text>
                          <Text style={styles.metaValue}>{value}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </>
              )}
            </View>

            <View style={styles.divider} />

            {/* SECTION 2 */}
            {colors.length > 0 && (
              <View style={styles.swatchSection}>
                <Text style={styles.sectionTitle}>Colour Guide</Text>

                <View style={styles.swatchGrid}>
                  {colors.map((color, index) => (
                    <View key={index} style={styles.swatchItem}>
                      <View
                        style={[
                          styles.swatchCircle,
                          { backgroundColor: color.hex || '#000' },
                        ]}
                      />

                      {hasText(color.pomFrontSrc) && (
                        <View style={styles.swatchPomFrame}>
                          <Image
                            src={color.pomFrontSrc}
                            style={styles.swatchThumb}
                          />
                        </View>
                      )}

                      <View style={styles.swatchTextWrap}>
                        <Text style={styles.swatchCode}>
                          {asText(color.pomLabel, color.hex)}
                        </Text>
                        {hasText(color.pomMaterial) && (
                          <Text style={styles.swatchMaterial}>
                            {color.pomMaterial}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.divider} />

            {/* SECTION 3 */}
            <View style={styles.bottomSection}>
              {textures.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>
                    Texture Examples
                  </Text>

                  <View style={styles.textureRow}>
                    {textures.map((texture, i) => (
                      <View key={i} style={styles.textureItem}>
                        {hasText(texture.imageSrc) && (
                          <Image
                            src={texture.imageSrc}
                            style={styles.textureImage}
                          />
                        )}
                      </View>
                    ))}
                  </View>
                </>
              )}

              {notes && (
                <>
                  <Text style={styles.sectionTitle}>Notes</Text>
                  <Text style={styles.notesText}>{notes}</Text>
                </>
              )}
            </View>

          </View>
        </View>

        <Text style={styles.footer}>
          {asText(data?.artworkReference, 'Artwork')}
        </Text>
      </Page>
    </Document>
  )
}
