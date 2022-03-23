// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "base64-sol/base64.sol";
import "./base/ERC721Checkpointable.sol";
import "./interfaces/iChimneyTownDAO.sol";

contract ChimneyTownDAO is iChimneyTownDAO, ERC721Checkpointable, Ownable {

    using Strings for uint256;

    uint256 public constant MAX_SUPPLY = 10000;
    uint256 private _nextPublicId = 0;
    // TODO update possibly
    uint256 private _nextReserveId = 9900;
    uint256 private _priceInWei;
    string private _imageURL;
    string private _animationURL;
    string private _externalURL;
    bool private _isOnSale;
    bool private _isMetadataFrozen;
    bytes32 private _merkleRoot;
    mapping(address => bool) private _claimMap;

    constructor(string memory imageURL) ERC721("CHIMNEY TOWN DAO", "CTD") {
        updateImageURL(imageURL);
    }

    modifier onSale() {
        require(_isOnSale, "ChimneyTownDAO: Not on sale");
        _;
    }

    modifier checkSupply(uint256 quantity) {
        require(_nextPublicId + quantity <= _nextReserveId, "ChimneyTownDAO: All public tokens are minted");
        _;
    }

    modifier whenNotFrozen() {
        require(!_isMetadataFrozen, "ChimneyTownDAO: Already frozen");
        _;
    }

    //******************************
    // view functions
    //******************************
    function nextPublicId() public view override returns (uint256) {
        return _nextPublicId;
    }

    function nextReserveId() public view override returns (uint256) {
        return _nextReserveId;
    }

    function priceInWei() public view override returns (uint256) {
        return _priceInWei;
    }

    function isOnSale() public view override returns (bool) {
        return _isOnSale;
    }

    function merkleRoot() public view override returns (bytes32) {
        return _merkleRoot;
    }

    function isClaimed(address account) external view override returns (bool) {
        return _claimMap[account];
    }

    function prepareMetadataJSON(uint256 tokenId) public view returns (string memory) {
        string memory json = string(abi.encodePacked(
                '{"name": "CHIMNEY TOWN DAO #', tokenId.toString(), '", ',
                '"description": "", ',
                '"image": "', _imageURL, '"')
        );
        if (keccak256(abi.encodePacked(_animationURL)) != keccak256(abi.encodePacked(""))) {
            json = string(abi.encodePacked(json, ', ', '"animation_url": "', _animationURL, '"'));
        }
        if (keccak256(abi.encodePacked(_externalURL)) != keccak256(abi.encodePacked(""))) {
            json = string(abi.encodePacked(json, ', ', '"external_url": "', _externalURL, '"'));
        }
        return string(abi.encodePacked(json, '}'));
    }

    function tokenURI(uint256 tokenId) override public view returns (string memory) {
        require(_exists(tokenId), "ChimneyTownDAO: URI query for nonexistent token");
        return string(abi.encodePacked('data:application/json;base64,', Base64.encode(bytes(prepareMetadataJSON(tokenId)))));
    }

    //******************************
    // public functions
    //******************************
    function mint() external override payable onSale checkSupply(1) {
        require(msg.value == _priceInWei, "ChimneyTownDAO: Invalid price");
        _safeMint(msg.sender, _nextPublicId++);
    }

    function mintBatch(uint256 quantity) external override payable onSale checkSupply(quantity) {
        require(msg.value == _priceInWei * quantity, "ChimneyTownDAO: Invalid price");
        for (uint256 i; i < quantity; i++) {
            _safeMint(msg.sender, _nextPublicId++);
        }
    }

    function claim(bytes32[] calldata merkleProof) external override payable checkSupply(1) {
        require(_merkleRoot != "", "ChimneyTownDAO: No merkle root");
        require(!_claimMap[msg.sender], "ChimneyTownDAO: Account minted token already");
        require(MerkleProof.verify(merkleProof, _merkleRoot, keccak256(abi.encodePacked(msg.sender))), "ChimneyTownDAO: Can not verify");

        _claimMap[msg.sender] = true;
        _safeMint(msg.sender, _nextPublicId++);
    }

    //******************************
    // admin functions
    //******************************
    function updateImageURL(string memory url) public override onlyOwner whenNotFrozen {
        _imageURL = url;
    }

    function updateAnimationURL(string memory url) public override onlyOwner whenNotFrozen {
        _animationURL = url;
    }

    function updateExternalURL(string memory url) public override onlyOwner whenNotFrozen {
        _externalURL = url;
    }

    function freezeMetadata() external override onlyOwner {
        _isMetadataFrozen = true;
    }

    function mintReserve(uint256 quantity, address to) external override onlyOwner {
        require(_nextReserveId + quantity <= MAX_SUPPLY, "ChimneyTownDAO: All reserved tokens are minted");
        for (uint256 i; i < quantity; i++) {
            _safeMint(to, _nextReserveId++);
        }
    }

    function setMerkleRoot(bytes32 __merkleRoot) external override onlyOwner {
        _merkleRoot = __merkleRoot;
    }

    function setPrice(uint256 __priceInWei) external override onlyOwner {
        _priceInWei = __priceInWei;
    }

    function setSaleStatus(bool __isOnSale) public override onlyOwner {
        require(_priceInWei != 0, "ChimneyTownDAO: Price is not set yet");
        _isOnSale = __isOnSale;
    }

    function withdraw(address payable to, uint256 amountInWei) external override onlyOwner {
        Address.sendValue(to, amountInWei);
    }

    receive() external payable {}

}