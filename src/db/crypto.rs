use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use rand::{rngs::OsRng, RngCore};
use std::env;

fn get_encryption_key() -> [u8; 32] {
    let key_hex = env::var("ENCRYPTION_KEY_SECRET")
        .expect("Missing ENCRYPTION_KEY_SECRET environment variable");

    let decoded = hex::decode(&key_hex).expect("ENCRYPTION_KEY_SECRET must be a valid hex string");

    assert_eq!(
        decoded.len(),
        32,
        "ENCRYPTION_KEY_SECRET must decode to exactly 32 bytes (64 hex characters)"
    );

    let mut key = [0u8; 32];
    key.copy_from_slice(&decoded);
    key
}

pub fn encrypt_secret(plain_text: &str) -> Result<String, String> {
    let key_bytes = get_encryption_key();
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plain_text.as_bytes())
        .map_err(|e| format!("Encryption error: {:?}", e))?;

    let mut combined = Vec::with_capacity(12 + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(hex::encode(combined))
}

pub fn decrypt_secret(hex_cipher: &str) -> Result<String, String> {
    let combined = hex::decode(hex_cipher).map_err(|e| format!("Invalid hex: {:?}", e))?;
    if combined.len() < 12 {
        return Err("Ciphertext too short".to_string());
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let key_bytes = get_encryption_key();
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let nonce = Nonce::from_slice(nonce_bytes);
    let decrypted = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption error: {:?}", e))?;

    String::from_utf8(decrypted).map_err(|e| format!("Invalid UTF8: {:?}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encryption_decryption_lifecycle() {
        unsafe {
            std::env::set_var(
                "ENCRYPTION_KEY_SECRET",
                "deadbeef0123456789abcdef0123456789abcdef0123456789abcdef01234567",
            );
        }
        let secret = "postgres://user:password@localhost:5432/dbname";
        let encrypted = encrypt_secret(secret).unwrap();
        assert_ne!(secret, encrypted);
        let decrypted = decrypt_secret(&encrypted).unwrap();
        assert_eq!(secret, decrypted);
    }
}
