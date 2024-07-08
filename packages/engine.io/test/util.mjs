// imported from https://github.com/fails-components/webtransport/blob/master/test/fixtures/certificate.js

// @ts-expect-error node-forge has no types and @types/node-forge do not include oids
import forge from 'node-forge'
import { webcrypto as crypto, X509Certificate } from 'crypto'

const { pki, asn1, oids } = forge
// taken from node-forge
/**
 * Converts an X.509 subject or issuer to an ASN.1 RDNSequence.
 *
 * @param {any} obj the subject or issuer (distinguished name).
 *
 * @return the ASN.1 RDNSequence.
 */
function _dnToAsn1(obj) {
  // create an empty RDNSequence
  const rval = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [])

  // iterate over attributes
  let attr, set
  const attrs = obj.attributes
  for (let i = 0; i < attrs.length; ++i) {
    attr = attrs[i]
    let value = attr.value

    // reuse tag class for attribute value if available
    let valueTagClass = asn1.Type.PRINTABLESTRING
    if ('valueTagClass' in attr) {
      valueTagClass = attr.valueTagClass

      if (valueTagClass === asn1.Type.UTF8) {
        value = forge.util.encodeUtf8(value)
      }
      // FIXME: handle more encodings
    }

    // create a RelativeDistinguishedName set
    // each value in the set is an AttributeTypeAndValue first
    // containing the type (an OID) and second the value
    set = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        // AttributeType
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.OID,
          false,
          asn1.oidToDer(attr.type).getBytes()
        ),
        // AttributeValue
        asn1.create(asn1.Class.UNIVERSAL, valueTagClass, false, value)
      ])
    ])
    rval.value.push(set)
  }

  return rval
}

const jan_1_1950 = new Date('1950-01-01T00:00:00Z') // eslint-disable-line camelcase
const jan_1_2050 = new Date('2050-01-01T00:00:00Z') // eslint-disable-line camelcase
// taken from node-forge almost not modified
/**
 * Converts a Date object to ASN.1
 * Handles the different format before and after 1st January 2050
 *
 * @param {Date} date date object.
 *
 * @return the ASN.1 object representing the date.
 */
function _dateToAsn1(date) {
  // eslint-disable-next-line camelcase
  if (date >= jan_1_1950 && date < jan_1_2050) {
    return asn1.create(
      asn1.Class.UNIVERSAL,
      asn1.Type.UTCTIME,
      false,
      asn1.dateToUtcTime(date)
    )
  } else {
    return asn1.create(
      asn1.Class.UNIVERSAL,
      asn1.Type.GENERALIZEDTIME,
      false,
      asn1.dateToGeneralizedTime(date)
    )
  }
}

// taken from node-forge almost not modified
/**
 * Convert signature parameters object to ASN.1
 *
 * @param {string} oid Signature algorithm OID
 * @param {any} params The signature parameters object
 * @return ASN.1 object representing signature parameters
 */
function _signatureParametersToAsn1(oid, params) {
  const parts = []

  switch (oid) {
    case oids['RSASSA-PSS']:
      if (params.hash.algorithmOid !== undefined) {
        parts.push(
          asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
              asn1.create(
                asn1.Class.UNIVERSAL,
                asn1.Type.OID,
                false,
                asn1.oidToDer(params.hash.algorithmOid).getBytes()
              ),
              asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, '')
            ])
          ])
        )
      }

      if (params.mgf.algorithmOid !== undefined) {
        parts.push(
          asn1.create(asn1.Class.CONTEXT_SPECIFIC, 1, true, [
            asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
              asn1.create(
                asn1.Class.UNIVERSAL,
                asn1.Type.OID,
                false,
                asn1.oidToDer(params.mgf.algorithmOid).getBytes()
              ),
              asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
                asn1.create(
                  asn1.Class.UNIVERSAL,
                  asn1.Type.OID,
                  false,
                  asn1.oidToDer(params.mgf.hash.algorithmOid).getBytes()
                ),
                asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, '')
              ])
            ])
          ])
        )
      }

      if (params.saltLength !== undefined) {
        parts.push(
          asn1.create(asn1.Class.CONTEXT_SPECIFIC, 2, true, [
            asn1.create(
              asn1.Class.UNIVERSAL,
              asn1.Type.INTEGER,
              false,
              asn1.integerToDer(params.saltLength).getBytes()
            )
          ])
        )
      }

      return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, parts)

    default:
      return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, '')
  }
}

// taken from node-forge and modified to work with ECDSA
/**
 * Gets the ASN.1 TBSCertificate part of an X.509v3 certificate.
 *
 * @param {any} cert the certificate.
 *
 * @return the asn1 TBSCertificate.
 */
function getTBSCertificate(cert) {
  // TBSCertificate
  const notBefore = _dateToAsn1(cert.validity.notBefore)
  const notAfter = _dateToAsn1(cert.validity.notAfter)

  const tbs = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    // version
    asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
      // integer
      asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.INTEGER,
        false,
        asn1.integerToDer(cert.version).getBytes()
      )
    ]),
    // serialNumber
    asn1.create(
      asn1.Class.UNIVERSAL,
      asn1.Type.INTEGER,
      false,
      forge.util.hexToBytes(cert.serialNumber)
    ),
    // signature
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      // algorithm
      asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.OID,
        false,
        asn1.oidToDer(cert.siginfo.algorithmOid).getBytes()
      ),
      // parameters
      _signatureParametersToAsn1(
        cert.siginfo.algorithmOid,
        cert.siginfo.parameters
      )
    ]),
    // issuer
    _dnToAsn1(cert.issuer),
    // validity
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      notBefore,
      notAfter
    ]),
    // subject
    _dnToAsn1(cert.subject),
    // SubjectPublicKeyInfo
    // here comes our modification, we are other objects here
    asn1.fromDer(
      new forge.util.ByteBuffer(
        cert.publicKey
      ) /* is in already SPKI format but in DER encoding */
    )
  ])

  if (cert.issuer.uniqueId) {
    // issuerUniqueID (optional)
    tbs.value.push(
      asn1.create(asn1.Class.CONTEXT_SPECIFIC, 1, true, [
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.BITSTRING,
          false,
          // TODO: support arbitrary bit length ids
          String.fromCharCode(0x00) + cert.issuer.uniqueId
        )
      ])
    )
  }
  if (cert.subject.uniqueId) {
    // subjectUniqueID (optional)
    tbs.value.push(
      asn1.create(asn1.Class.CONTEXT_SPECIFIC, 2, true, [
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.BITSTRING,
          false,
          // TODO: support arbitrary bit length ids
          String.fromCharCode(0x00) + cert.subject.uniqueId
        )
      ])
    )
  }

  if (cert.extensions.length > 0) {
    // extensions (optional)
    tbs.value.push(pki.certificateExtensionsToAsn1(cert.extensions))
  }

  return tbs
}

// function taken form selfsigned
// a hexString is considered negative if it's most significant bit is 1
// because serial numbers use ones' complement notation
// this RFC in section 4.1.2.2 requires serial numbers to be positive
// http://www.ietf.org/rfc/rfc5280.txt
/**
 * @param {string} hexString
 * @returns
 */
function toPositiveHex(hexString) {
  let mostSiginficativeHexAsInt = parseInt(hexString[0], 16)
  if (mostSiginficativeHexAsInt < 8) {
    return hexString
  }

  mostSiginficativeHexAsInt -= 8
  return mostSiginficativeHexAsInt.toString() + hexString.substring(1)
}

// the next is an edit of the selfsigned function reduced to the function necessary for webtransport
/**
 * @typedef {object} Certificate
 * @property {string} public
 * @property {string} private
 * @property {string} cert
 * @property {Uint8Array} hash
 * @property {string} fingerprint
 *
 * @param {*} attrs
 * @param {*} options
 * @returns {Promise<Certificate | null>}
 */
export async function generateWebTransportCertificate(attrs, options) {
  try {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,
      ['sign', 'verify']
    )

    const cert = pki.createCertificate()

    cert.serialNumber = toPositiveHex(
      forge.util.bytesToHex(forge.random.getBytesSync(9))
    ) // the serial number can be decimal or hex (if preceded by 0x)
    cert.validity.notBefore = new Date()
    cert.validity.notAfter = new Date()
    cert.validity.notAfter.setDate(
      cert.validity.notBefore.getDate() + (options.days || 14)
    ) // per spec only 14 days allowed

    cert.setSubject(attrs)
    cert.setIssuer(attrs)

    const privateKey = crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
    const publicKey = (cert.publicKey = await crypto.subtle.exportKey(
      'spki',
      keyPair.publicKey
    ))

    cert.setExtensions(
      options.extensions || [
        {
          name: 'basicConstraints',
          cA: true
        },
        {
          name: 'keyUsage',
          keyCertSign: true,
          digitalSignature: true,
          nonRepudiation: true,
          keyEncipherment: true,
          dataEncipherment: true
        },
        {
          name: 'subjectAltName',
          altNames: [
            {
              type: 6, // URI
              value: 'http://example.org/webid#me'
            }
          ]
        }
      ]
    )

    // to signing
    // patch oids object
    oids['1.2.840.10045.4.3.2'] = 'ecdsa-with-sha256'
    oids['ecdsa-with-sha256'] = '1.2.840.10045.4.3.2'

    cert.siginfo.algorithmOid = cert.signatureOid = '1.2.840.10045.4.3.2' // 'ecdsa-with-sha256'

    cert.tbsCertificate = getTBSCertificate(cert)
    const encoded = Buffer.from(
      asn1.toDer(cert.tbsCertificate).getBytes(),
      'binary'
    )
    cert.md = crypto.subtle.digest('SHA-256', encoded)
    cert.signature = crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' }
      },
      keyPair.privateKey,
      encoded
    )
    cert.md = await cert.md
    cert.signature = await cert.signature

    const pemcert = pki.certificateToPem(cert)

    const x509cert = new X509Certificate(pemcert)

    const certhash = Buffer.from(
      x509cert.fingerprint256.split(':').map((el) => parseInt(el, 16))
    )

    const pem = {
      private: forge.pem.encode({
        type: 'PRIVATE KEY',
        body: new forge.util.ByteBuffer(await privateKey).getBytes()
      }),
      public: forge.pem.encode({
        type: 'PUBLIC KEY',
        body: new forge.util.ByteBuffer(publicKey).getBytes()
      }),
      cert: pemcert,
      hash: certhash,
      fingerprint: x509cert.fingerprint256
    }

    return pem
  } catch (error) {
    console.log('error in generate certificate', error)
    return null
  }
}
