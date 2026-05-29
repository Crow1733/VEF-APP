function loadView(fileName, button) {
    const frame = document.getElementById('viewer-frame');
    const buttons = document.querySelectorAll('.nav-tab');

    frame.src = fileName;
    buttons.forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
}