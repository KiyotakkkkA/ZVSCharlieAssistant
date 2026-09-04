fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    napi_build::setup();
}
